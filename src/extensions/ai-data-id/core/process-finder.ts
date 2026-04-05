import { execFile } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import { ProcessInfo } from './types';

const execFileAsync = promisify(execFile);

// ── Constants ────────────────────────────────────────────────────────

/** Maximum time (ms) to wait for a port health-check response. */
const PORT_PROBE_TIMEOUT_MS = 2_000;

/** Delay (ms) between retry attempts during process detection. */
const RETRY_DELAY_MS = 500;

/** Default maximum number of retries for process detection. */
const DEFAULT_MAX_RETRIES = 2;

/** Unified, robust regex for capturing the Antigravity CSRF token across all OS environments. */
const CSRF_TOKEN_REGEX = /--csrf_token[=\s]+([a-zA-Z0-9\-]+)/i;

// ── Platform-specific process names ──────────────────────────────────

const PROCESS_NAMES: Record<string, string> = {
	win32_x64: 'language_server_windows_x64.exe',
	darwin_x64: 'language_server_macos',
	darwin_arm64: 'language_server_macos_arm',
	linux_x64: 'language_server_linux_x64',
	linux_arm64: 'language_server_linux_arm',
};

/**
 * Detects the Antigravity language server process running locally
 * and discovers a working HTTPS port to communicate with it.
 *
 * Supports Windows (PowerShell), macOS, and Linux (x64 & ARM64).
 */
export class ProcessFinder {
	private readonly processName: string;

	constructor() {
		const key = `${process.platform}_${process.arch}`;
		this.processName = PROCESS_NAMES[key]
			?? PROCESS_NAMES[`${process.platform}_x64`]
			?? 'language_server_linux_x64';
	}

	/**
	 * Attempts to detect the Antigravity process and find a working port.
	 * @param maxRetries - Number of detection attempts before giving up.
	 * @returns Connection info or `null` if the process could not be found.
	 */
	async detectProcessInfo(maxRetries: number = DEFAULT_MAX_RETRIES): Promise<ProcessInfo | null> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				const info = await this.getProcessInfoForPlatform();
				if (info) {
					const ports = await this.getListeningPorts(info.pid);
					const validPort = await this.findWorkingPort(ports, info.csrfToken);

					if (validPort) {
						return {
							connectPort: validPort,
							csrfToken: info.csrfToken,
						};
					}
				}
			} catch (e) {
				console.error('[ai-data-id] Process detection error:', e);
			}

			if (i < maxRetries - 1) {
				await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
			}
		}
		return null;
	}

	private async getProcessInfoForPlatform(): Promise<{ pid: number; csrfToken: string } | null> {
		if (process.platform === 'win32') {
			return this.detectWindows();
		}
		return this.detectUnix();
	}

	private async detectWindows(): Promise<{ pid: number; csrfToken: string } | null> {
		const psScript = `Get-CimInstance Win32_Process -Filter "name='${this.processName}'" | Select-Object ProcessId,CommandLine | ConvertTo-Json`;
		const { stdout } = await execFileAsync(
			'powershell', ['-NoProfile', '-Command', psScript],
		);

		try {
			let data = JSON.parse(stdout.trim()) as { ProcessId: number; CommandLine?: string } | Array<{ ProcessId: number; CommandLine?: string }>;
			if (Array.isArray(data)) {
				const antigravityProcess = data.find(
					(item) => item.CommandLine?.toLowerCase().includes('antigravity')
				);
				if (!antigravityProcess) { return null; }
				data = antigravityProcess;
			}

			const commandLine = data.CommandLine || '';
			const tokenMatch = commandLine.match(CSRF_TOKEN_REGEX);
			if (!tokenMatch) { return null; }

			return { pid: data.ProcessId, csrfToken: tokenMatch[1] };
		} catch {
			return null;
		}
	}

	private async detectUnix(): Promise<{ pid: number; csrfToken: string } | null> {
		const flag = process.platform === 'darwin' ? '-fl' : '-af';

		const { stdout } = await execFileAsync('pgrep', [flag, this.processName]);

		for (const line of stdout.split('\n')) {
			if (line.includes('antigravity') && line.includes('--csrf_token')) {
				const parts = line.trim().split(/\s+/);
				const pid = parseInt(parts[0], 10);
				if (!Number.isFinite(pid)) { continue; }
				const tokenMatch = line.match(CSRF_TOKEN_REGEX);

				if (tokenMatch) {
					return { pid, csrfToken: tokenMatch[1] };
				}
			}
		}
		return null;
	}

	private async getListeningPorts(pid: number): Promise<number[]> {
		const ports: number[] = [];
		try {
			if (process.platform === 'win32') {
				const psScript = `Get-NetTCPConnection -OwningProcess ${pid} -State Listen | Select-Object -ExpandProperty LocalPort | ConvertTo-Json`;
				const { stdout } = await execFileAsync(
					'powershell', ['-NoProfile', '-Command', psScript],
				);
				const data = JSON.parse(stdout.trim());
				if (Array.isArray(data)) { ports.push(...data); }
				else if (typeof data === 'number') { ports.push(data); }
			} else if (process.platform === 'darwin') {
				const { stdout } = await execFileAsync(
					'lsof', ['-nP', '-a', '-iTCP', '-sTCP:LISTEN', '-p', String(pid)],
				);
				this.parseLsofOutput(stdout, ports);
			} else {
				// On Linux, try `ss` first, fallback to `lsof`
				try {
					const { stdout } = await execFileAsync('ss', ['-tlnp']);
					const pidFilter = `pid=${pid}`;
					for (const line of stdout.split('\n')) {
						if (line.includes(pidFilter)) {
							const ssRegex = /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+)/gi;
							let match;
							while ((match = ssRegex.exec(line)) !== null) {
								ports.push(parseInt(match[1], 10));
							}
						}
					}
				} catch {
					// ss not available, try lsof
					const { stdout } = await execFileAsync(
						'lsof', ['-nP', '-a', '-iTCP', '-sTCP:LISTEN', '-p', String(pid)],
					);
					this.parseLsofOutput(stdout, ports);
				}
			}
		} catch {
			// Port detection may fail silently; retries will handle it
		}
		return [...new Set(ports)].sort((a, b) => a - b);
	}

	/** Extracts port numbers from `lsof` output. */
	private parseLsofOutput(stdout: string, ports: number[]): void {
		const lsofRegex = /(?:TCP|UDP)\s+(?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s+\(LISTEN\)/gim;
		let match;
		while ((match = lsofRegex.exec(stdout)) !== null) {
			ports.push(parseInt(match[1], 10));
		}
	}

	/**
	 * Tests all candidate ports in parallel and returns the first one
	 * that responds successfully to an HTTPS health-check.
	 *
	 * **Security note**: `rejectUnauthorized: false` is intentional here.
	 * The language server uses a self-signed certificate on `127.0.0.1`.
	 * The CSRF token provides authentication; TLS here is only for transport encryption.
	 */
	private async findWorkingPort(ports: number[], csrfToken: string): Promise<number | null> {
		if (ports.length === 0) { return null; }
		const activeRequests = new Set<ReturnType<typeof https.request>>();

		const cancelPendingRequests = (): void => {
			for (const request of activeRequests) {
				request.destroy();
			}
			activeRequests.clear();
		};

		const testPort = (port: number): Promise<number> => {
			return new Promise((resolve, reject) => {
				const req = https.request({
					hostname: '127.0.0.1', port,
					path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Codeium-Csrf-Token': csrfToken,
						'Connect-Protocol-Version': '1',
					},
					rejectUnauthorized: false, // Self-signed cert on localhost (see JSDoc above)
					timeout: PORT_PROBE_TIMEOUT_MS,
				}, res => {
					res.resume(); // Consume the stream to prevent socket memory leaks
					if (res.statusCode === 200) {
						cancelPendingRequests();
						resolve(port);
					}
					else { reject(new Error(`Status: ${res.statusCode}`)); }
				});
				activeRequests.add(req);
				req.on('close', () => {
					activeRequests.delete(req);
				});
				req.on('error', reject);
				req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
				req.write(JSON.stringify({ wrapper_data: {} }));
				req.end();
			});
		};

		try {
			// Tests all ports in parallel. Resolves instantly with the first successful port.
			const workingPort = await Promise.any(ports.map(testPort));
			cancelPendingRequests();
			return workingPort;
		} catch {
			// AggregateError thrown if all ports fail
			cancelPendingRequests();
			return null;
		}
	}
}

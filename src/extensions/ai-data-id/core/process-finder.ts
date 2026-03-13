import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import { ProcessInfo } from './types';

const execAsync = promisify(exec);

/**
 * Detects the Antigravity language server process running locally
 * and finds a working port to communicate with it.
 */
export class ProcessFinder {
	private processName: string;

	constructor() {
		if (process.platform === 'win32') {
			this.processName = 'language_server_windows_x64.exe';
		} else if (process.platform === 'darwin') {
			this.processName = `language_server_macos${process.arch === 'arm64' ? '_arm' : ''}`;
		} else {
			this.processName = `language_server_linux${process.arch === 'arm64' ? '_arm' : '_x64'}`;
		}
	}

	async detectProcessInfo(maxRetries: number = 2): Promise<ProcessInfo | null> {
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
				await new Promise(r => setTimeout(r, 500));
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
		const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\\\"name='${this.processName}'\\\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
		const { stdout } = await execAsync(cmd);

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
			const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-f0-9\-]+)/i);
			if (!tokenMatch) { return null; }

			return { pid: data.ProcessId, csrfToken: tokenMatch[1] };
		} catch {
			return null;
		}
	}

	private async detectUnix(): Promise<{ pid: number; csrfToken: string } | null> {
		const flag = process.platform === 'darwin' ? '-fl' : '-af';
		const cmd = `pgrep ${flag} ${this.processName}`;
		const { stdout } = await execAsync(cmd);

		for (const line of stdout.split('\n')) {
			if (line.includes('antigravity') && line.includes('--csrf_token')) {
				const parts = line.trim().split(/\s+/);
				const pid = parseInt(parts[0], 10);
				if (!Number.isFinite(pid)) { continue; }
				const tokenMatch = line.match(/--csrf_token[=\s]+([a-zA-Z0-9\-]+)/);

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
				const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen | Select-Object -ExpandProperty LocalPort | ConvertTo-Json"`;
				const { stdout } = await execAsync(cmd);
				const data = JSON.parse(stdout.trim());
				if (Array.isArray(data)) { ports.push(...data); }
				else if (typeof data === 'number') { ports.push(data); }
			} else {
				const cmd = process.platform === 'darwin'
					? `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid}`
					: `ss -tlnp 2>/dev/null | grep "pid=${pid}" || lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null`;
				const { stdout } = await execAsync(cmd);

				const lsofRegex = /(?:TCP|UDP)\s+(?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s+\(LISTEN\)/gim;
				let match;
				while ((match = lsofRegex.exec(stdout)) !== null) { ports.push(parseInt(match[1], 10)); }

				const ssRegex = /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+)/gi;
				while ((match = ssRegex.exec(stdout)) !== null) { ports.push(parseInt(match[1], 10)); }
			}
		} catch {
			// Port detection may fail silently, retries will handle it
		}
		return [...new Set(ports)].sort((a, b) => a - b);
	}

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
					rejectUnauthorized: false,
					timeout: 2000,
				}, res => {
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
		} catch (e) {
			// AggregateError thrown if all ports fail
			cancelPendingRequests();
			return null;
		}
	}
}

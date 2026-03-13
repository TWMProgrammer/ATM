import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import { process_info } from './types';

const execAsync = promisify(exec);

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

	async detectProcessInfo(maxRetries: number = 2): Promise<process_info | null> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				const info = await this.getProcessInfoForPlatform();
				if (info) {
					const ports = await this.getListeningPorts(info.pid);
					const validPort = await this.findWorkingPort(ports, info.csrf_token);
					
					if (validPort) {
						return {
							extension_port: info.extension_port,
							connect_port: validPort,
							csrf_token: info.csrf_token,
						};
					}
				}
			} catch (e) {
				console.error('ATM DataID Process detection error:', e);
			}

			if (i < maxRetries - 1) {
				await new Promise(r => setTimeout(r, 500));
			}
		}
		return null;
	}

	private async getProcessInfoForPlatform(): Promise<{pid: number, extension_port: number, csrf_token: string} | null> {
		if (process.platform === 'win32') {
			const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name='${this.processName}'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
			const { stdout } = await execAsync(cmd);
			try {
				let data = JSON.parse(stdout.trim());
				if (Array.isArray(data)) {
					const ant = data.filter((item: any) => item.CommandLine && item.CommandLine.toLowerCase().includes('antigravity'));
					if (ant.length > 0) {data = ant[0];}
					else {return null;}
				}
				const cl = data.CommandLine || '';
				const tokenMatch = cl.match(/--csrf_token[=\s]+([a-f0-9\-]+)/i);
				if (!tokenMatch) {return null;}
				return { pid: data.ProcessId, extension_port: 0, csrf_token: tokenMatch[1] };
			} catch { return null; }
		} else {
			const cmd = process.platform === 'darwin' ? `pgrep -fl ${this.processName}` : `pgrep -af ${this.processName}`;
			const { stdout } = await execAsync(cmd);
			const lines = stdout.split('\n');
			for (const line of lines) {
				if (line.includes('antigravity') && line.includes('--csrf_token')) {
					const parts = line.trim().split(/\s+/);
					const pid = parseInt(parts[0], 10);
					const tokenMatch = line.match(/--csrf_token[=\s]+([a-zA-Z0-9\-]+)/);
					if (tokenMatch) {
						return { pid, extension_port: 0, csrf_token: tokenMatch[1] };
					}
				}
			}
			return null;
		}
	}

	private async getListeningPorts(pid: number): Promise<number[]> {
		const ports: number[] = [];
		try {
			if (process.platform === 'win32') {
				const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen | Select-Object -ExpandProperty LocalPort | ConvertTo-Json"`;
				const { stdout } = await execAsync(cmd);
				const data = JSON.parse(stdout.trim());
				if (Array.isArray(data)) {ports.push(...data);}
				else if (typeof data === 'number') {ports.push(data);}
			} else {
				const cmd = process.platform === 'darwin' 
                    ? `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid}` 
                    : `ss -tlnp 2>/dev/null | grep "pid=${pid}" || lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null`;
				const { stdout } = await execAsync(cmd);
				
                const lsof_regex = new RegExp(`(?:TCP|UDP)\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]+\\]):(\\d+)\\s+\\(LISTEN\\)`, 'gim');
				let match;
				while ((match = lsof_regex.exec(stdout)) !== null) {ports.push(parseInt(match[1], 10));}

                const ss_regex = new RegExp(`LISTEN\\s+\\d+\\s+\\d+\\s+(?:\\*|[\\d.]+|\\[[\\da-f:]*\\]):(\\d+)`, 'gi');
				while ((match = ss_regex.exec(stdout)) !== null) {ports.push(parseInt(match[1], 10));}
			}
		} catch (e) {
		}
		return [...new Set(ports)].sort((a,b)=>a-b);
	}

	private async findWorkingPort(ports: number[], csrfToken: string): Promise<number | null> {
		for (const port of ports) {
			const working = await new Promise(resolve => {
				const req = https.request({
					hostname: '127.0.0.1', port, path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
					method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Codeium-Csrf-Token': csrfToken, 'Connect-Protocol-Version': '1' },
					rejectUnauthorized: false, timeout: 2000
				}, res => {
					resolve(res.statusCode === 200);
				});
				req.on('error', () => resolve(false));
				req.on('timeout', () => { req.destroy(); resolve(false); });
				req.write(JSON.stringify({wrapper_data: {}}));
				req.end();
			});
			if (working) {return port;}
		}
		return null;
	}
}

import * as https from 'https';
import { QuotaSnapshot, ServerUserStatusResponse, ModelQuotaInfo } from './types';

/**
 * Manages the connection to the local Antigravity language server
 * and fetches AI model quota/usage data.
 */
export class QuotaManager {
	private port: number = 0;
	private csrfToken: string = '';

	init(port: number, csrfToken: string): void {
		this.port = port;
		this.csrfToken = csrfToken;
	}

	reset(): void {
		this.port = 0;
		this.csrfToken = '';
	}

	isConnected(): boolean {
		return this.port !== 0;
	}

	getConnectionInfo(): { connectPort: number; csrfToken: string } | null {
		if (!this.isConnected()) { return null; }
		return { connectPort: this.port, csrfToken: this.csrfToken };
	}

	async fetchQuota(): Promise<QuotaSnapshot | null> {
		if (!this.isConnected()) {
			throw new Error('Connection not initialized');
		}

		return new Promise((resolve, reject) => {
			const data = JSON.stringify({
				metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' },
			});

			const req = https.request({
				hostname: '127.0.0.1',
				port: this.port,
				path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data),
					'Connect-Protocol-Version': '1',
					'X-Codeium-Csrf-Token': this.csrfToken,
				},
				rejectUnauthorized: false,
				timeout: 5000,
			}, res => {
				let body = '';
				res.on('data', chunk => body += chunk);
				res.on('end', () => {
					try {
						const json = JSON.parse(body) as ServerUserStatusResponse;
						resolve(this.parseResponse(json));
					} catch (e) {
						reject(e);
					}
				});
			});
			req.on('error', reject);
			req.on('timeout', () => { req.destroy(); reject(new Error('Request Timeout')); });
			req.write(data);
			req.end();
		});
	}

	private parseResponse(data: ServerUserStatusResponse): QuotaSnapshot {
		const { userStatus } = data;
		if (!userStatus?.cascadeModelConfigData) {
			return { timestamp: new Date(), models: [] };
		}

		const rawModels = userStatus.cascadeModelConfigData.clientModelConfigs || [];
		const models: ModelQuotaInfo[] = rawModels
			.filter((m: any) => m.quotaInfo)
			.map((m: any) => {
				const resetTime = new Date(m.quotaInfo.resetTime);
				const diff = resetTime.getTime() - Date.now();
				return {
					label: m.label,
					modelId: m.modelOrAlias?.model || 'unknown',
					remainingFraction: m.quotaInfo.remainingFraction,
					remainingPercentage: m.quotaInfo.remainingFraction !== undefined
						? m.quotaInfo.remainingFraction * 100
						: undefined,
					isExhausted: m.quotaInfo.remainingFraction === 0,
					resetTime,
					timeUntilReset: diff,
					timeUntilResetFormatted: this.formatTime(diff),
				};
			});

		return { timestamp: new Date(), models };
	}

	private formatTime(ms: number): string {
		if (ms <= 0) { return 'Ready'; }
		const mins = Math.ceil(ms / 60000);
		if (mins < 60) { return `${mins}m`; }
		const hours = Math.floor(mins / 60);
		return `${hours}h ${mins % 60}m`;
	}
}

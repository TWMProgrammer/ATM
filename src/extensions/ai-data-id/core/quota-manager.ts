import * as https from 'https';
import {
	QuotaSnapshot,
	ServerUserStatusResponse,
	ModelQuotaInfo,
	PromptCreditsInfo,
	ServerClientModelConfig,
} from './types';

/**
 * Manages the connection to the local Antigravity language server
 * and fetches AI model quota/usage data.
 */
export class QuotaManager {
	private port: number = 0;
	private csrfToken: string = '';
	private sharedAgent = new https.Agent({ keepAlive: true });

	init(port: number, csrfToken: string): void {
		this.port = port;
		this.csrfToken = csrfToken;
	}

	reset(): void {
		this.port = 0;
		this.csrfToken = '';
	}

	dispose(): void {
		this.sharedAgent.destroy();
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
				agent: this.sharedAgent,
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
					if (res.statusCode !== 200) {
						reject(new Error(`Unexpected status ${res.statusCode}: ${body.slice(0, 200)}`));
						return;
					}
					if (!body.trim()) {
						reject(new Error('Empty response body from quota endpoint'));
						return;
					}
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
			return {
				timestamp: new Date(),
				promptCredits: this.parsePromptCredits(data),
				models: [],
			};
		}

		const rawModels: ServerClientModelConfig[] = userStatus.cascadeModelConfigData.clientModelConfigs || [];
		const models: ModelQuotaInfo[] = rawModels
			.filter(m => m.quotaInfo)
			.map(m => {
				const rawFraction = m.quotaInfo?.remainingFraction;
				const remainingFraction = this.normalizeFraction(rawFraction);

				const resetTime = m.quotaInfo?.resetTime ? new Date(m.quotaInfo.resetTime) : new Date();
				const diff = resetTime.getTime() - Date.now();
				return {
					label: m.label || 'Unknown model',
					modelId: m.modelOrAlias?.model || 'unknown',
					remainingFraction,
					remainingPercentage: remainingFraction !== undefined
						? remainingFraction * 100
						: undefined,
					isExhausted: remainingFraction === 0,
					resetTime,
					timeUntilReset: diff,
					timeUntilResetFormatted: this.formatTime(diff),
				};
			});

		return {
			timestamp: new Date(),
			promptCredits: this.parsePromptCredits(data),
			models,
		};
	}

	private parsePromptCredits(data: ServerUserStatusResponse): PromptCreditsInfo | undefined {
		const planStatus = data.userStatus?.planStatus;
		if (!planStatus) { return undefined; }

		const monthly = planStatus.planInfo?.monthlyPromptCredits;
		const available = planStatus.availablePromptCredits;
		if (!Number.isFinite(monthly) || !Number.isFinite(available) || monthly <= 0) {
			return undefined;
		}

		const usedPercentage = ((monthly - available) / monthly) * 100;
		const remainingPercentage = (available / monthly) * 100;

		return {
			available,
			monthly,
			usedPercentage: Math.min(Math.max(usedPercentage, 0), 100),
			remainingPercentage: Math.min(Math.max(remainingPercentage, 0), 100),
		};
	}

	private normalizeFraction(value: number | undefined): number | undefined {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return undefined;
		}
		return Math.min(Math.max(value, 0), 1);
	}

	private formatTime(ms: number): string {
		if (ms <= 0) { return 'Ready'; }
		const mins = Math.ceil(ms / 60000);
		if (mins < 60) { return `${mins}m`; }
		const hours = Math.floor(mins / 60);
		if (hours >= 24) {
			const days = Math.floor(hours / 24);
			const remHours = hours % 24;
			return `${days}d ${remHours}h`;
		}
		return `${hours}h ${mins % 60}m`;
	}
}

import * as https from 'https';
import { quota_snapshot, server_user_status_response, model_quota_info } from './types';

export class QuotaManager {
	private port: number = 0;
	private csrfToken: string = '';

	init(port: number, csrfToken: string) {
		this.port = port;
		this.csrfToken = csrfToken;
	}

    getProcessInfo() {
        if (this.port === 0) {return null;}
        return { connect_port: this.port, csrf_token: this.csrfToken };
    }

	async fetchQuota(): Promise<quota_snapshot | null> {
        if (this.port === 0) {throw new Error("Connection not initialized");}
        
		return new Promise((resolve, reject) => {
			const data = JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } });
			const req = https.request({
				hostname: '127.0.0.1', port: this.port, path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
				method: 'POST', headers: {
					'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data),
					'Connect-Protocol-Version': '1', 'X-Codeium-Csrf-Token': this.csrfToken,
				},
				rejectUnauthorized: false, timeout: 5000
			}, res => {
				let body = '';
				res.on('data', chunk => body += chunk);
				res.on('end', () => {
					try {
						const json = JSON.parse(body) as server_user_status_response;
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

	private parseResponse(data: server_user_status_response): quota_snapshot {
		const userStatus = data.userStatus;
        if (!userStatus || !userStatus.cascadeModelConfigData) {
              return { timestamp: new Date(), models: [] };
        }
		const rawModels = userStatus.cascadeModelConfigData.clientModelConfigs || [];
		const models: model_quota_info[] = rawModels
			.filter((m: any) => m.quotaInfo)
			.map((m: any) => {
				const resetTime = new Date(m.quotaInfo.resetTime);
				const diff = resetTime.getTime() - new Date().getTime();
				return {
					label: m.label,
					model_id: m.modelOrAlias?.model || 'unknown',
					remaining_fraction: m.quotaInfo.remainingFraction,
					remaining_percentage: m.quotaInfo.remainingFraction !== undefined ? m.quotaInfo.remainingFraction * 100 : undefined,
					is_exhausted: m.quotaInfo.remainingFraction === 0,
					reset_time: resetTime,
					time_until_reset: diff,
					time_until_reset_formatted: this.formatTime(diff, resetTime),
				};
			});

		// Reverse sorting order to show more important models at the top (or just leave natural order)
		return { timestamp: new Date(), models };
	}

	private formatTime(ms: number, resetTime: Date): string {
		if (ms <= 0) {return 'Ready';}
		const mins = Math.ceil(ms / 60000);
		if (mins < 60) {return `${mins}m`;}
		const hours = Math.floor(mins / 60);
		return `${hours}h ${mins % 60}m`;
	}
}

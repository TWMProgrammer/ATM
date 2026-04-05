import * as https from 'https';
import {
	QuotaSnapshot,
	ServerUserStatusResponse,
	ModelQuotaInfo,
	PromptCreditsInfo,
	ServerClientModelConfig,
} from './types';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum time (ms) to wait for a quota API response. */
const QUOTA_REQUEST_TIMEOUT_MS = 5_000;

/** Endpoint path for the GetUserStatus RPC. */
const USER_STATUS_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUserStatus';

/** Minimum value for a quota fraction (clamped). */
const FRACTION_MIN = 0;
/** Maximum value for a quota fraction (clamped). */
const FRACTION_MAX = 1;

/** Minimum value for a percentage (clamped). */
const PERCENTAGE_MIN = 0;
/** Maximum value for a percentage (clamped). */
const PERCENTAGE_MAX = 100;

// ── Time formatting thresholds ───────────────────────────────────────

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/**
 * Manages the connection to the local Antigravity language server
 * and fetches AI model quota/usage data via its HTTPS API.
 *
 * Lifecycle:
 *   1. Call `init()` with a port and CSRF token (obtained from `ProcessFinder`)
 *   2. Call `fetchQuota()` periodically to get usage snapshots
 *   3. Call `reset()` on connection errors (triggers re-detection)
 *   4. Call `dispose()` when the extension is deactivated
 *
 * **Security note**: `rejectUnauthorized: false` is intentional.
 * The language server runs on `127.0.0.1` with a self-signed certificate.
 * Authentication is handled by the CSRF token, not TLS certificate validation.
 */
export class QuotaManager {
	private port: number = 0;
	private csrfToken: string = '';
	private sharedAgent = new https.Agent({ keepAlive: true });

	/** Initialize the connection parameters. Must be called before `fetchQuota()`. */
	init(port: number, csrfToken: string): void {
		this.port = port;
		this.csrfToken = csrfToken;
	}

	/** Reset the connection, forcing a fresh process detection on next fetch. */
	reset(): void {
		this.port = 0;
		this.csrfToken = '';
		this.sharedAgent.destroy();
		this.sharedAgent = new https.Agent({ keepAlive: true });
	}

	/** Clean up the shared HTTPS agent. Call on extension deactivation. */
	dispose(): void {
		this.sharedAgent.destroy();
	}

	/** Whether the manager has valid connection parameters. */
	isConnected(): boolean {
		return this.port !== 0;
	}

	/** Returns current connection info, or `null` if not connected. */
	getConnectionInfo(): { connectPort: number; csrfToken: string } | null {
		if (!this.isConnected()) { return null; }
		return { connectPort: this.port, csrfToken: this.csrfToken };
	}

	/**
	 * Fetches a fresh quota snapshot from the language server.
	 * @throws {Error} If the connection is not initialized or the request fails.
	 */
	async fetchQuota(): Promise<QuotaSnapshot | null> {
		if (!this.isConnected()) {
			throw new Error('Connection not initialized. Call init() first.');
		}

		return new Promise((resolve, reject) => {
			const data = JSON.stringify({
				metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' },
			});

			const req = https.request({
				hostname: '127.0.0.1',
				port: this.port,
				path: USER_STATUS_ENDPOINT,
				method: 'POST',
				agent: this.sharedAgent,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(data),
					'Connect-Protocol-Version': '1',
					'X-Codeium-Csrf-Token': this.csrfToken,
				},
				rejectUnauthorized: false, // Self-signed cert on localhost (see class JSDoc)
				timeout: QUOTA_REQUEST_TIMEOUT_MS,
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

	// ── Response parsing ─────────────────────────────────────────────

	private parseResponse(data: ServerUserStatusResponse): QuotaSnapshot {
		const { userStatus } = data;
		const planName = userStatus?.planStatus?.planInfo?.planName;
		const teamsTier = userStatus?.planStatus?.planInfo?.teamsTier;
		if (!userStatus?.cascadeModelConfigData) {
			return {
				timestamp: new Date(),
				planName,
				teamsTier,
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

				// A model is exhausted if:
				// 1. Its remaining fraction is explicitly 0
				// 2. OR it has a reset time but NO remaining fraction (common for exhausted Claude/GPT-OSS models)
				const isExhausted = remainingFraction === 0 || (remainingFraction === undefined && m.quotaInfo?.resetTime !== undefined && diff > 0);

				return {
					label: m.label || 'Unknown model',
					modelId: m.modelOrAlias?.model || 'unknown',
					remainingFraction,
					remainingPercentage: remainingFraction !== undefined
						? remainingFraction * PERCENTAGE_MAX
						: undefined,
					isExhausted,
					resetTime,
					timeUntilReset: diff,
					timeUntilResetFormatted: QuotaManager.formatTime(diff),
				};
			});

		return {
			timestamp: new Date(),
			planName,
			teamsTier,
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

		const usedPercentage = ((monthly - available) / monthly) * PERCENTAGE_MAX;
		const remainingPercentage = (available / monthly) * PERCENTAGE_MAX;

		return {
			available,
			monthly,
			usedPercentage: Math.min(Math.max(usedPercentage, PERCENTAGE_MIN), PERCENTAGE_MAX),
			remainingPercentage: Math.min(Math.max(remainingPercentage, PERCENTAGE_MIN), PERCENTAGE_MAX),
		};
	}

	// ── Pure utility methods (static for testability) ────────────────

	/**
	 * Clamps a raw fraction to the [0, 1] range.
	 * Returns `undefined` for non-finite or missing values (means "unlimited").
	 */
	private normalizeFraction(value: number | undefined): number | undefined {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return undefined;
		}
		return Math.min(Math.max(value, FRACTION_MIN), FRACTION_MAX);
	}

	/**
	 * Formats a duration in milliseconds into a human-readable string.
	 *
	 * @example
	 * formatTime(0)         // → "Ready"
	 * formatTime(300_000)   // → "5m"
	 * formatTime(5_400_000) // → "1h 30m"
	 * formatTime(90_000_000) // → "1d 1h"
	 */
	static formatTime(ms: number): string {
		if (ms <= 0) { return 'Ready'; }
		const mins = Math.ceil(ms / MS_PER_MINUTE);
		if (mins < MINUTES_PER_HOUR) { return `${mins}m`; }
		const hours = Math.floor(mins / MINUTES_PER_HOUR);
		if (hours >= HOURS_PER_DAY) {
			const days = Math.floor(hours / HOURS_PER_DAY);
			const remHours = hours % HOURS_PER_DAY;
			return `${days}d ${remHours}h`;
		}
		return `${hours}h ${mins % MINUTES_PER_HOUR}m`;
	}
}

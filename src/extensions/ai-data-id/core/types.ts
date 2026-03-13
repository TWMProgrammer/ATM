/**
 * @module types
 * Pure data contracts for the AI Data extension.
 * Separated into two layers:
 *   - **Client types**: used internally across the extension (`ModelQuotaInfo`, `QuotaSnapshot`, etc.)
 *   - **Server types**: mirror the raw JSON shape from the Antigravity language server API
 */

// ── Client-side types ────────────────────────────────────────────────

/** Quota information for a single AI model, already normalized. */
export interface ModelQuotaInfo {
	/** Human-readable model name (e.g. "Gemini 3.1 Pro (High)") */
	label: string;
	/** Machine-readable model identifier */
	modelId: string;
	/** Remaining quota as a fraction [0, 1]. `undefined` = unlimited. */
	remainingFraction?: number;
	/** Remaining quota as a percentage [0, 100]. `undefined` = unlimited. */
	remainingPercentage?: number;
	/** Whether the model has reached 0% quota */
	isExhausted: boolean;
	/** Absolute time when the quota resets */
	resetTime: Date;
	/** Milliseconds until the quota resets */
	timeUntilReset: number;
	/** Human-readable time until reset (e.g. "2h 30m") */
	timeUntilResetFormatted: string;
}

/** Prompt credit information for the user's plan. */
export interface PromptCreditsInfo {
	/** Credits currently available */
	available: number;
	/** Total monthly credit allowance */
	monthly: number;
	/** Percentage of credits consumed [0, 100] */
	usedPercentage: number;
	/** Percentage of credits remaining [0, 100] */
	remainingPercentage: number;
}

/** A point-in-time snapshot of all quota data. */
export interface QuotaSnapshot {
	/** When the snapshot was captured */
	timestamp: Date;
	/** Prompt credit info, if available in the plan */
	promptCredits?: PromptCreditsInfo;
	/** Per-model quota information */
	models: ModelQuotaInfo[];
}

// ── Server-side types (raw API shapes) ───────────────────────────────

/** Raw quota info as returned by the language server. */
export interface ServerModelQuotaInfo {
	remainingFraction?: number;
	resetTime?: string;
}

/** Raw model/alias reference from the server. */
export interface ServerModelOrAlias {
	model?: string;
}

/** Raw client model config from the server. */
export interface ServerClientModelConfig {
	label?: string;
	modelOrAlias?: ServerModelOrAlias;
	quotaInfo?: ServerModelQuotaInfo;
}

/** Full server response shape for the GetUserStatus endpoint. */
export interface ServerUserStatusResponse {
	userStatus: {
		name: string;
		email: string;
		planStatus?: {
			planInfo: {
				teamsTier: string;
				planName: string;
				monthlyPromptCredits: number;
				monthlyFlowCredits: number;
			};
			availablePromptCredits: number;
			availableFlowCredits: number;
		};
		cascadeModelConfigData?: {
			clientModelConfigs: ServerClientModelConfig[];
		};
	};
}

// ── Shared utility types ─────────────────────────────────────────────

/** Information needed to connect to the local Antigravity process. */
export interface ProcessInfo {
	/** HTTPS port the language server is listening on */
	connectPort: number;
	/** CSRF token extracted from the process command line */
	csrfToken: string;
}

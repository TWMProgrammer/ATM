export interface ModelQuotaInfo {
	label: string;
	modelId: string;
	remainingFraction?: number;
	remainingPercentage?: number;
	isExhausted: boolean;
	resetTime: Date;
	timeUntilReset: number;
	timeUntilResetFormatted: string;
}

export interface PromptCreditsInfo {
	available: number;
	monthly: number;
	usedPercentage: number;
	remainingPercentage: number;
}

export interface QuotaSnapshot {
	timestamp: Date;
	promptCredits?: PromptCreditsInfo;
	models: ModelQuotaInfo[];
}

export interface ServerModelQuotaInfo {
	remainingFraction?: number;
	resetTime?: string;
}

export interface ServerModelOrAlias {
	model?: string;
}

export interface ServerClientModelConfig {
	label?: string;
	modelOrAlias?: ServerModelOrAlias;
	quotaInfo?: ServerModelQuotaInfo;
}

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

export interface ProcessInfo {
	connectPort: number;
	csrfToken: string;
}

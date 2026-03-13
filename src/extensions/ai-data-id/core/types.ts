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
			clientModelConfigs: any[];
		};
	};
}

export interface ProcessInfo {
	extensionPort: number;
	connectPort: number;
	csrfToken: string;
}

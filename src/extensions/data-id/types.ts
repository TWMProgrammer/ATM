export interface model_quota_info {
	label: string;
	model_id: string;
	remaining_fraction?: number;
	remaining_percentage?: number;
	is_exhausted: boolean;
	reset_time: Date;
	time_until_reset: number;
	time_until_reset_formatted: string;
}

export interface prompt_credits_info {
	available: number;
	monthly: number;
	used_percentage: number;
	remaining_percentage: number;
}

export interface quota_snapshot {
	timestamp: Date;
	prompt_credits?: prompt_credits_info;
	models: model_quota_info[];
}

export interface server_user_status_response {
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

export interface process_info {
	extension_port: number;
	connect_port: number;
	csrf_token: string;
}

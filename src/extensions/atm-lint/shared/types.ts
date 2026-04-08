// Shared types for IPC messages, configuration, and common interfaces

export const ATM_LINT_REVALIDATE_REQUEST = 'atm/lint/revalidateOpenDocuments';

export interface RevalidateOpenDocumentsResponse {
	revalidatedDocuments: number;
}

export const ATM_LINT_STATUS_NOTIFICATION = 'atm/lint/status';

export interface AtmLintStatusParams {
	status: 'ok' | 'missing-config' | 'error';
	message?: string;
}

// Shared types for IPC messages, configuration, and common interfaces

export const ATM_LINT_REVALIDATE_REQUEST = 'atm/lint/revalidateOpenDocuments';

export interface RevalidateOpenDocumentsResponse {
	revalidatedDocuments: number;
}

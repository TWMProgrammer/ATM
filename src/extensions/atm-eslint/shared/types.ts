// Shared types for IPC messages, configuration, and common interfaces

export const ATM_ESLINT_REVALIDATE_REQUEST = 'atm/eslint/revalidateOpenDocuments';

export interface RevalidateOpenDocumentsResponse {
	revalidatedDocuments: number;
}

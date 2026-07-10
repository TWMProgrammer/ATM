export interface GitmojiEntry {
	readonly emoji: string;
	readonly code: string;
	readonly description: string;
}

export interface CustomGitmojiEntry {
	emoji?: string;
	code?: string;
	description?: string;
}

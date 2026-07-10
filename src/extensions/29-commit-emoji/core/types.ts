export interface CommitEmojiEntry {
	readonly emoji: string;
	readonly code: string;
	readonly description: string;
}

export interface CustomCommitEmojiEntry {
	emoji?: string;
	code?: string;
	description?: string;
}

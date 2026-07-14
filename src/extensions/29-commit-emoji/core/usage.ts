import * as vscode from 'vscode';
import type { CommitEmojiEntry } from './types';

const STORAGE_KEY = 'atm.commitEmoji.usage';

/**
 * Load the persisted emoji usage counts from globalState.
 * Returns an empty object when no records exist yet.
 */
export function loadUsageCounts(context: vscode.ExtensionContext): Record<string, number> {
	return context.globalState.get<Record<string, number>>(STORAGE_KEY, {}) ?? {};
}

/**
 * Increment the usage count for the given emoji and persist it.
 * Prefers `code` as the key; falls back to `emoji`.
 */
export async function incrementUsageCount(
	context: vscode.ExtensionContext,
	code?: string,
	emoji?: string,
): Promise<void> {
	const key = getEmojiKey(code, emoji);
	if (!key) {return;}
	const usage = loadUsageCounts(context);
	usage[key] = (usage[key] || 0) + 1;
	await context.globalState.update(STORAGE_KEY, usage);
}

/**
 * Sort the emoji list by usage frequency (descending), preserving insertion
 * order for ties (stable sort).
 */
export function sortEmojisByUsage(
	emojis: Array<Partial<CommitEmojiEntry>>,
	usage: Record<string, number>,
): Array<Partial<CommitEmojiEntry>> {
	return emojis
		.map((item, idx) => ({ item, idx }))
		.sort((a, b) => {
			const ac = usage[getEmojiKey(a.item.code, a.item.emoji)] || 0;
			const bc = usage[getEmojiKey(b.item.code, b.item.emoji)] || 0;
			if (ac !== bc) {return bc - ac;} // descending
			return a.idx - b.idx; // stable
		})
		.map((x) => x.item);
}

/**
 * Returns the tracking key for an emoji entry.
 * Prefers `code`; falls back to `emoji`; returns '' if neither is available.
 */
export function getEmojiKey(code?: string, emoji?: string): string {
	if (code && code.length > 0) {return code;}
	if (emoji && emoji.length > 0) {return emoji;}
	return '';
}

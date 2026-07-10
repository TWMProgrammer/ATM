import type { CommitEmojiEntry } from './types';
import CommitEmoji from '../data';
import { loadUsageCounts, sortEmojisByUsage } from './usage';
import * as vscode from 'vscode';

// A simple map of keywords to gitmoji codes for intelligent auto-matching
const keywordMap: Record<string, string> = {
	fix: ':bug:',
	bug: ':bug:',
	issue: ':bug:',
	feat: ':sparkles:',
	add: ':sparkles:',
	new: ':sparkles:',
	docs: ':memo:',
	readme: ':memo:',
	style: ':art:',
	format: ':art:',
	refactor: ':recycle:',
	clean: ':recycle:',
	test: ':white_check_mark:',
	tests: ':white_check_mark:',
	chore: ':wrench:',
	build: ':hammer_and_wrench:',
	perf: ':zap:',
	speed: ':zap:',
	wip: ':construction:',
	revert: ':rewind:',
	merge: ':twisted_rightwards_arrows:',
	deps: ':arrow_up:',
	security: ':lock:',
	init: ':tada:',
	deploy: ':rocket:',
	ui: ':lipstick:',
	ux: ':children_crossing:',
	seo: ':mag:',
	types: ':label:',
	config: ':wrench:',
};

export function getBestEmojiForCommit(
	commitMessage: string,
	context: vscode.ExtensionContext,
	customEmojis: CommitEmojiEntry[] = []
): CommitEmojiEntry {
	const allEmojis = [...CommitEmoji, ...customEmojis];
	const words = commitMessage.toLowerCase().split(/[\s,.-]+/);

	// 1. Try keyword mapping first
	for (const word of words) {
		if (keywordMap[word]) {
			const match = allEmojis.find((e) => e.code === keywordMap[word]);
			if (match) { return match; }
		}
	}

	// 2. Try matching words with emoji descriptions
	for (const word of words) {
		if (word.length < 3) { continue; } // Skip very short words
		const match = allEmojis.find((e) => e.description?.toLowerCase().includes(word));
		if (match) { return match; }
	}

	// 3. Fallback to most used emoji
	const usage = loadUsageCounts(context);
	const sorted = sortEmojisByUsage(allEmojis, usage);
	if (sorted.length > 0 && usage[sorted[0].code ?? '']) {
		return sorted[0] as CommitEmojiEntry;
	}

	// 4. Ultimate fallback (✨)
	return allEmojis.find((e) => e.code === ':sparkles:') ?? allEmojis[0];
}

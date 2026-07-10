import * as vscode from 'vscode';
import Gitmoji from './core/gitmoji';
import type { CustomGitmojiEntry } from './core/types';
import { loadUsageCounts, sortEmojisByUsage, incrementUsageCount } from './core/usage';
import { updateCommit, buildTokenPattern } from './core/commitUtils';
import {
	getGitExtension,
	focusScmInputForRepoIndex,
	tryInsertIntoCommitEditor,
	tryTypeIntoScmInput,
} from './core/gitHelper';

const COMMAND_ID = 'atm.commitEmoji.show';

export function activateCommitEmoji(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(COMMAND_ID, async (uri?) => {
		const git = getGitExtension();
		if (!git) {
			vscode.window.showErrorMessage('ATM Commit Emoji: Unable to load Git Extension');
			return;
		}

		// ── Read configuration ────────────────────────────────────────────────
		const cfg = vscode.workspace.getConfiguration('atm.commitEmoji');
		const addCustomEmoji = cfg.get<CustomGitmojiEntry[]>('addCustomEmoji', []);
		const showEmojiCode  = cfg.get<boolean>('showEmojiCode', false);
		const onlyCustom     = cfg.get<boolean>('onlyUseCustomEmoji', false);
		const autoMatch      = cfg.get<boolean>('autoMatch', false);
		const outputType     = cfg.get<string>('outputType', 'emoji');
		const insertPosition = cfg.get<string>('insertPosition', 'start');
		const canRepeat      = cfg.get<boolean>('canRepeat', false);

		// ── Build emoji list ──────────────────────────────────────────────────
		const allEmojis = onlyCustom
			? [...addCustomEmoji]
			: [...Gitmoji, ...addCustomEmoji];

		let emojis = [...allEmojis];

		// Auto-match: filter by current commit message text
		if (autoMatch && git.repositories.length > 0) {
			const comment = git.repositories[0].inputBox.value.toLowerCase();
			if (comment.length > 0) {
				const matched = emojis.filter(
					(e) =>
						e.description?.toLowerCase().includes(comment) ||
						e.code?.toLowerCase().includes(comment),
				);
				if (matched.length > 0) {emojis = matched;}
			}
		}

		// Sort by most-used first (stable)
		const usage = loadUsageCounts(context);
		emojis = sortEmojisByUsage(emojis, usage);

		// ── Build QuickPick items ─────────────────────────────────────────────
		const items = emojis.map((e) => ({
			label: `${e.emoji ?? ''} ${e.description ?? ''} ${showEmojiCode ? (e.code ?? '') : ''}`.trimEnd(),
			code: e.code,
			emoji: e.emoji,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a gitmoji for your commit message',
			matchOnDescription: true,
		});
		if (!selected) {return;}

		await incrementUsageCount(context, selected.code, selected.emoji);

		const valueToAdd = outputType === 'emoji' ? (selected.emoji ?? '') : (selected.code ?? '');
		const preferCursor = insertPosition === 'cursor';

		// Build the full token list so existing tokens are stripped on replace
		const allTokens: string[] = Array.from(
			new Set([
				...allEmojis.map((e) => e.emoji).filter(Boolean) as string[],
				...allEmojis.map((e) => e.code).filter(Boolean) as string[],
			]),
		);

		// ── Insert into commit message ────────────────────────────────────────
		let targetIndex: number | undefined;

		if (uri) {
			// Triggered from SCM title bar of a specific repository
			const uriPath = (uri._rootUri?.path ?? uri.rootUri?.path) as string | undefined;
			const selectedRepo = git.repositories.find(
				(r) => r.rootUri.path === uriPath,
			);
			if (selectedRepo) {
				targetIndex = git.repositories.findIndex(
					(r) => r.rootUri.path === selectedRepo.rootUri.path,
				);
				if (preferCursor) {
					if (await tryInsertIntoCommitEditor(valueToAdd)) {return;}
					await focusScmInputForRepoIndex(targetIndex);
					if (await tryTypeIntoScmInput(valueToAdd)) {return;}
					updateCommit(selectedRepo, valueToAdd, false, allTokens, canRepeat);
				} else {
					const useSuffix = insertPosition === 'end';
					updateCommit(selectedRepo, valueToAdd, useSuffix, allTokens, canRepeat);
				}
			}
		} else {
			// Triggered from command palette — affects all repositories
			if (preferCursor) {
				if (await tryInsertIntoCommitEditor(valueToAdd)) {return;}
				if (git.repositories.length > 0) {
					targetIndex = 0;
					await focusScmInputForRepoIndex(targetIndex);
					if (await tryTypeIntoScmInput(valueToAdd)) {return;}
				}
				for (const repo of git.repositories) {
					updateCommit(repo, valueToAdd, false, allTokens, canRepeat);
				}
			} else {
				const useSuffix = insertPosition === 'end';
				for (const repo of git.repositories) {
					updateCommit(repo, valueToAdd, useSuffix, allTokens, canRepeat);
				}
				if (git.repositories.length === 1) {targetIndex = 0;}
			}
		}

		await focusScmInputForRepoIndex(targetIndex);
	});

	context.subscriptions.push(disposable);
}

// Re-export token helpers for potential use by tests
export { buildTokenPattern };

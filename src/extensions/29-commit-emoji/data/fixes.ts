import * as vscode from 'vscode';
import type { CommitEmojiEntry } from '../core/types';

export const fixes: CommitEmojiEntry[] = [
	{ emoji: '🐛', code: ':bug:', description: vscode.l10n.t('Fix a bug') },
	{ emoji: '🚑', code: ':ambulance:', description: vscode.l10n.t('Critical hotfix') },
	{ emoji: '🔒️', code: ':lock:', description: vscode.l10n.t('Fix security or privacy issues') },
	{ emoji: '🚨', code: ':rotating_light:', description: vscode.l10n.t('Fix compiler/linter warnings') },
	{ emoji: '💚', code: ':green_heart:', description: vscode.l10n.t('Fix CI Build') },
	{ emoji: '🩹', code: ':adhesive_bandage:', description: vscode.l10n.t('Simple fix for a non-critical issue') },
	{ emoji: '⏪', code: ':rewind:', description: vscode.l10n.t('Revert changes') },
	{ emoji: '✏️', code: ':pencil2:', description: vscode.l10n.t('Fix typos') },
	{ emoji: '🥅', code: ':goal_net:', description: vscode.l10n.t('Catch errors') },
];

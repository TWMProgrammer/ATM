import * as vscode from 'vscode';
import type { CommitEmojiEntry } from '../core/types';

export const plus: CommitEmojiEntry[] = [
	{ emoji: '🦄', code: ':unicorn:', description: vscode.l10n.t('Initialize a nested project') },
	{ emoji: '⚽️', code: ':soccer:', description: vscode.l10n.t('Finish a project or milestone') },
	{ emoji: '✅', code: ':white_check_mark:', description: vscode.l10n.t('Done or success') },
	{ emoji: '🟥', code: ':red_square:', description: vscode.l10n.t('Red component or error state') },
	{ emoji: '🟦', code: ':blue_square:', description: vscode.l10n.t('Blue component or info state') },
	{ emoji: '🟩', code: ':green_square:', description: vscode.l10n.t('Green component or success state') },
	{ emoji: '🟨', code: ':yellow_square:', description: vscode.l10n.t('Yellow component or warning state') },
];

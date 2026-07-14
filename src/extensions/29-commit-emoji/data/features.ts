import * as vscode from 'vscode';
import type { CommitEmojiEntry } from '../core/types';

export const features: CommitEmojiEntry[] = [
	{ emoji: '🎉', code: ':tada:', description: vscode.l10n.t('Begin a project') },
	{ emoji: '💄', code: ':lipstick:', description: vscode.l10n.t('Add or update the UI and style files') },
	{ emoji: '📱', code: ':iphone:', description: vscode.l10n.t('Work on responsive design') },
	{ emoji: '🌐', code: ':globe_with_meridians:', description: vscode.l10n.t('Internationalization and localization') },
	{ emoji: '♿️', code: ':wheelchair:', description: vscode.l10n.t('Improve accessibility') },
	{ emoji: '💫', code: ':dizzy:', description: vscode.l10n.t('Add or update animations and transitions') },
	{ emoji: '🚸', code: ':children_crossing:', description: vscode.l10n.t('Improve user experience/usability') },
	{ emoji: '✈️', code: ':airplane:', description: vscode.l10n.t('Improve offline support') },
];

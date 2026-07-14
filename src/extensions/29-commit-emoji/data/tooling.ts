import * as vscode from 'vscode';
import type { CommitEmojiEntry } from '../core/types';

export const tooling: CommitEmojiEntry[] = [
	{ emoji: '🏗️', code: ':building_construction:', description: vscode.l10n.t('Add new files or make architectural changes') },
	{ emoji: '📐', code: ':triangular_ruler:', description: vscode.l10n.t('Make architectural or design pattern changes') },
	{ emoji: '🛠️', code: ':hammer_and_wrench:', description: vscode.l10n.t('Edit multiple files or update tooling/build scripts') },
	{ emoji: '🔧', code: ':wrench:', description: vscode.l10n.t('Edit or adjust one file') },
	{ emoji: '👷', code: ':construction_worker:', description: vscode.l10n.t('Add or update CI build system') },
	{ emoji: '🔨', code: ':hammer:', description: vscode.l10n.t('Add or update development scripts') },
	{ emoji: '📦', code: ':package:', description: vscode.l10n.t('Add or update compiled files or packages') },
	{ emoji: '🚚', code: ':truck:', description: vscode.l10n.t('Move or rename resources (e.g.: files, paths, routes)') },
	{ emoji: '🍱', code: ':bento:', description: vscode.l10n.t('Add or update assets') },
	{ emoji: '📸', code: ':camera_flash:', description: vscode.l10n.t('Add or update snapshots') },
	{ emoji: '🔍', code: ':mag:', description: vscode.l10n.t('Improve SEO') },
	{ emoji: '🏷️', code: ':label:', description: vscode.l10n.t('Add or update types') },
	{ emoji: '🧱', code: ':bricks:', description: vscode.l10n.t('Infrastructure related changes') },
	{ emoji: '📝', code: ':memo:', description: vscode.l10n.t('Add or update documentation') },
];

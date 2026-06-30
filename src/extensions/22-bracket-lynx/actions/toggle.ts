import * as vscode from 'vscode';
import { CONFIG_SECTION } from '../core/constants';
import { getConfig, isGlobalEnabled } from '../core/config';
import { updateBracketDecorations, clearBracketDecorations } from '../providers/bracketProvider';
import { updateFrameworkDecorations, clearFrameworkDecorations } from '../providers/frameworkProvider';
import { clearAllCache } from '../core/cache';
export { changeColor } from './color';

const GLOBAL_ENABLED_KEY = 'globalEnabled';

let context: vscode.ExtensionContext | undefined;

function getDisabledFiles(): Set<string> {
	const stored = context?.workspaceState.get<string[]>('bracketLynx.disabledFiles', []);
	return new Set(stored ?? []);
}

function getEnabledFiles(): Set<string> {
	const stored = context?.workspaceState.get<string[]>('bracketLynx.enabledFiles', []);
	return new Set(stored ?? []);
}

async function saveDisabledFiles(files: Set<string>): Promise<void> {
	await context?.workspaceState.update('bracketLynx.disabledFiles', Array.from(files));
}

async function saveEnabledFiles(files: Set<string>): Promise<void> {
	await context?.workspaceState.update('bracketLynx.enabledFiles', Array.from(files));
}

function getDocumentKey(document: vscode.TextDocument): string {
	return document.uri.toString();
}

export function initializeToggleState(extensionContext: vscode.ExtensionContext): void {
	context = extensionContext;
}

export function isExtensionEnabled(): boolean {
	return isGlobalEnabled() || getEnabledFiles().size > 0;
}

export function isEditorEnabled(editor: vscode.TextEditor): boolean {
	const key = getDocumentKey(editor.document);
	if (isGlobalEnabled()) {
		return !getDisabledFiles().has(key);
	}
	return getEnabledFiles().has(key);
}

export function isDocumentEnabled(document: vscode.TextDocument): boolean {
	const key = getDocumentKey(document);
	if (isGlobalEnabled()) {
		return !getDisabledFiles().has(key);
	}
	return getEnabledFiles().has(key);
}

function updateEditor(editor: vscode.TextEditor): void {
	if (isEditorEnabled(editor)) {
		updateBracketDecorations(editor);
		updateFrameworkDecorations(editor);
	} else {
		clearBracketDecorations(editor);
		clearFrameworkDecorations(editor);
	}
}

export async function toggleGlobal(): Promise<void> {
	const config = getConfig();
	const current = isGlobalEnabled();
	await config.update(GLOBAL_ENABLED_KEY, !current, vscode.ConfigurationTarget.Global);

	if (!current) {
		await saveEnabledFiles(new Set());
		await saveDisabledFiles(new Set());
	}

	for (const editor of vscode.window.visibleTextEditors) {
		updateEditor(editor);
	}

	vscode.window.showInformationMessage(
		current ? 'Bracket Lynx disabled globally' : 'Bracket Lynx enabled globally',
	);
}

export async function toggleCurrentFile(): Promise<void> {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		vscode.window.showWarningMessage('No active editor to toggle');
		return;
	}

	const key = getDocumentKey(activeEditor.document);
	if (isGlobalEnabled()) {
		const disabled = getDisabledFiles();
		if (disabled.has(key)) {
			disabled.delete(key);
		} else {
			disabled.add(key);
		}
		await saveDisabledFiles(disabled);
	} else {
		const enabled = getEnabledFiles();
		if (enabled.has(key)) {
			enabled.delete(key);
		} else {
			enabled.add(key);
		}
		await saveEnabledFiles(enabled);
	}

	updateEditor(activeEditor);
	vscode.window.showInformationMessage(
		isEditorEnabled(activeEditor) ? 'Bracket Lynx enabled for current file' : 'Bracket Lynx disabled for current file',
	);
}

export async function resetToDefault(): Promise<void> {
	const confirmation = await vscode.window.showWarningMessage(
		'Reset Bracket Lynx to factory defaults?',
		{ modal: true },
		'Reset to Default',
	);

	if (confirmation !== 'Reset to Default') {
		return;
	}

	const config = getConfig();
	await Promise.all([
		config.update(GLOBAL_ENABLED_KEY, true, vscode.ConfigurationTarget.Global),
		config.update('prefix', '=> ', vscode.ConfigurationTarget.Global),
		config.update('color', '#515151', vscode.ConfigurationTarget.Global),
		config.update('fontStyle', 'italic', vscode.ConfigurationTarget.Global),
		config.update('unmatchBracketsPrefix', 'x ', vscode.ConfigurationTarget.Global),
		config.update('mode', 'auto', vscode.ConfigurationTarget.Global),
		config.update('debug', false, vscode.ConfigurationTarget.Global),
		config.update('maxBracketHeaderLength', 50, vscode.ConfigurationTarget.Global),
		config.update('minBracketScopeLines', 4, vscode.ConfigurationTarget.Global),
		config.update('enablePerformanceFilters', true, vscode.ConfigurationTarget.Global),
		config.update('maxFileSize', 5 * 1024 * 1024, vscode.ConfigurationTarget.Global),
		config.update('maxDecorationsPerFile', 300, vscode.ConfigurationTarget.Global),
	]);

	await saveDisabledFiles(new Set());
	await saveEnabledFiles(new Set());
	clearAllCache();

	for (const editor of vscode.window.visibleTextEditors) {
		updateEditor(editor);
	}

	vscode.window.showInformationMessage('Bracket Lynx reset to defaults');
}

export function refreshDecorations(): void {
	clearAllCache();
	for (const editor of vscode.window.visibleTextEditors) {
		updateEditor(editor);
	}
}

export function getMenuOptions(): vscode.QuickPickItem[] {
	const globalStatus = isGlobalEnabled() ? 'On' : 'Off';
	const activeEditor = vscode.window.activeTextEditor;
	const fileStatus = activeEditor ? (isEditorEnabled(activeEditor) ? 'On' : 'Off') : 'N/A';

	return [
		{ label: `$(globe) Toggle Global (${globalStatus})`, description: 'Enable/disable for all files' },
		{ label: `$(file) Toggle Current File (${fileStatus})`, description: 'Enable/disable for current file' },
		{ label: '$(color-mode) Change Color', description: 'Change decoration color' },
		{ label: '$(refresh) Refresh', description: 'Force refresh decorations' },
		{ label: '$(discard) Restore Default', description: 'Reset all settings to defaults' },
	];
}

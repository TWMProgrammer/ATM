import * as vscode from 'vscode';
import { updateBracketDecorations, clearBracketDecorations, disposeBracketDecorations } from './providers/bracketProvider';
import { updateFrameworkDecorations, clearFrameworkDecorations, disposeFrameworkDecorations } from './providers/frameworkProvider';
import { initializeToggleState, isExtensionEnabled, isEditorEnabled, isDocumentEnabled, getMenuOptions, toggleGlobal, toggleCurrentFile, changeColor as changeColorAction, refreshDecorations, resetToDefault } from './actions/toggle';
import { CONFIG_SECTION, PERFORMANCE_LIMITS } from './core/constants';
import { getMode } from './core/config';
import { clearDocumentCache, clearAllCache } from './core/cache';

const debounceTimers = new Map<string, NodeJS.Timeout>();

function debounce(key: string, callback: () => void, delay: number): void {
	const existing = debounceTimers.get(key);
	if (existing) {
		clearTimeout(existing);
	}
	const timer = setTimeout(() => {
		debounceTimers.delete(key);
		callback();
	}, delay);
	debounceTimers.set(key, timer);
}

function updateEditor(editor: vscode.TextEditor): void {
	if (!isExtensionEnabled() || !isEditorEnabled(editor)) {
		clearBracketDecorations(editor);
		clearFrameworkDecorations(editor);
		return;
	}

	updateBracketDecorations(editor);
	updateFrameworkDecorations(editor);
}

function scheduleUpdate(editor: vscode.TextEditor): void {
	const document = editor.document;
	const isLargeFile = document.getText().length > PERFORMANCE_LIMITS.LARGE_FILE_THRESHOLD;
	const delay = isLargeFile ? 300 : 150;
	debounce(`bracket-lynx-${document.uri.toString()}`, () => updateEditor(editor), delay);
}

function scheduleUpdateByDocument(document: vscode.TextDocument): void {
	const editors = vscode.window.visibleTextEditors.filter((e) => e.document === document);
	for (const editor of editors) {
		scheduleUpdate(editor);
	}
}

export function activateBracketLynx(context: vscode.ExtensionContext): void {
	initializeToggleState(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('atm.bracketLynx.toggleGlobal', toggleGlobal),
		vscode.commands.registerCommand('atm.bracketLynx.toggleCurrentFile', toggleCurrentFile),
		vscode.commands.registerCommand('atm.bracketLynx.changeColor', changeColorAction),
		vscode.commands.registerCommand('atm.bracketLynx.refresh', refreshDecorations),
		vscode.commands.registerCommand('atm.bracketLynx.resetToDefault', resetToDefault),
		vscode.commands.registerCommand('atm.bracketLynx.menu', () => {
			void vscode.window.showQuickPick(getMenuOptions(), {
				placeHolder: 'Choose Bracket Lynx action...',
			}).then((selected) => {
				if (!selected) {
					return;
				}
				const label = selected.label;
				if (label.includes('Toggle Global')) {
					void toggleGlobal();
				} else if (label.includes('Toggle Current File')) {
					void toggleCurrentFile();
				} else if (label.includes('Change Color')) {
					void changeColorAction();
				} else if (label.includes('Refresh')) {
					refreshDecorations();
				} else if (label.includes('Restore Default')) {
					void resetToDefault();
				}
			});
		}),
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(CONFIG_SECTION)) {
				clearAllCache();
				for (const editor of vscode.window.visibleTextEditors) {
					updateEditor(editor);
				}
			}
		}),
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!isExtensionEnabled() || !isDocumentEnabled(event.document)) {
				return;
			}
			clearDocumentCache(event.document);
			if (getMode() === 'auto') {
				scheduleUpdateByDocument(event.document);
			}
		}),
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (!isExtensionEnabled() || !isDocumentEnabled(document)) {
				return;
			}
			if (getMode() === 'auto') {
				scheduleUpdateByDocument(document);
			}
		}),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				updateEditor(editor);
			}
		}),
	);

	for (const editor of vscode.window.visibleTextEditors) {
		updateEditor(editor);
	}

	console.log('[ATM] Bracket Lynx activated');
}

export function deactivateBracketLynx(): void {
	for (const timer of debounceTimers.values()) {
		clearTimeout(timer);
	}
	debounceTimers.clear();

	disposeBracketDecorations();
	disposeFrameworkDecorations();
	clearAllCache();

	console.log('[ATM] Bracket Lynx deactivated');
}

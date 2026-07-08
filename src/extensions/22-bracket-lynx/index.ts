import * as vscode from 'vscode';
import { updateBracketDecorations, clearBracketDecorations, disposeBracketDecorations } from './providers/bracketProvider';
import { updateFrameworkDecorations, clearFrameworkDecorations, disposeFrameworkDecorations } from './providers/frameworkProvider';
import { initializeToggleState, isExtensionEnabled, toggleGlobal } from './actions/toggle';
import { CONFIG_SECTION, PERFORMANCE_LIMITS } from './core/constants';
import { clearDocumentCache, clearAllCache } from './core/cache';
import { updateToolState } from '../shared/atm-control-panel/utils';

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
	if (!isExtensionEnabled()) {
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

function syncControlPanelState(): void {
	const enabled = isExtensionEnabled();
	updateToolState({
		id: 'bracket-lynx',
		name: 'Bracket Lynx',
		icon: '$(bracket-dot)',
		command: 'atm.bracketLynx.toggle',
		description: enabled ? 'Active' : 'Disabled',
		category: 'ui',
		priority: 5,
	});
}

export function activateBracketLynx(context: vscode.ExtensionContext): void {
	initializeToggleState(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('atm.bracketLynx.toggle', async () => {
			await toggleGlobal();
			syncControlPanelState();
			for (const editor of vscode.window.visibleTextEditors) {
				updateEditor(editor);
			}
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
			if (!isExtensionEnabled()) {
				return;
			}
			clearDocumentCache(event.document);
			scheduleUpdateByDocument(event.document);
		}),
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (!isExtensionEnabled()) {
				return;
			}
			scheduleUpdateByDocument(document);
		}),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				updateEditor(editor);
			}
		}),
		vscode.window.onDidChangeTextEditorSelection((event) => {
			updateEditor(event.textEditor);
		}),
	);

	syncControlPanelState();
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

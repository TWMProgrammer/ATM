import * as vscode from 'vscode';
import { updateAllVersions, updateVersionString } from './commands/updateCommand';
import { DependencyInfo } from './core/parser';
import { clearPackageState, getDocumentCache } from './core/state';
import { clearVersionCache } from './core/versionFetcher';
import { canUpdateVersionString, getVersionStatus } from './core/versionStatus';
import { clearDecorationRuns, updateDecorations } from './ui/decorator';
import { VersionHoverProvider } from './ui/hoverProvider';
import { createDecorationStyles, VersionDecorationStyles } from './ui/styles';

const debounceTimers = new Map<string, NodeJS.Timeout>();
const activeChecks = new Set<string>();
const DEBOUNCE_MS = 600;

export function activateVersionPackage(context: vscode.ExtensionContext): void {
	const styles = createDecorationStyles();

	context.subscriptions.push(
		vscode.commands.registerCommand('atm.versionPackage.updateVersionString', updateVersionString)
	);

	context.subscriptions.push(vscode.commands.registerCommand('atm.versionPackage.updateAll', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !editor.document.fileName.endsWith('package.json')) {
			return;
		}

		const cache = getDocumentCache(editor.document.uri.toString());
		const toUpdate: { dep: DependencyInfo; newVersion: string }[] = [];

		cache.forEach(state => {
			const status = getVersionStatus(state.currentVersion, state.info);
			if (status.safeTarget && canUpdateVersionString(state.currentVersion)) {
				toUpdate.push({
					dep: {
						name: state.name,
						currentVersion: state.currentVersion,
						line: state.line,
						range: new vscode.Range(state.line, 0, state.line, 0)
					},
					newVersion: status.safeTarget
				});
			}
		});

		if (toUpdate.length > 0) {
			await updateAllVersions(toUpdate, editor.document);
		} else {
			await vscode.window.showInformationMessage(vscode.l10n.t('No safe package updates are available.'));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('atm.versionPackage.check', () => {
		clearVersionCache();
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.fileName.endsWith('package.json')) {
			const uri = editor.document.uri.toString();
			activeChecks.add(uri);
			clearPackageState(uri);
			triggerUpdateDecorations(editor.document, styles);
		}
	}));

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ language: 'json', pattern: '**/package.json' },
			new VersionHoverProvider()
		)
	);

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
		const uri = event.document.uri.toString();
		if (event.document.languageId === 'json' && event.document.fileName.endsWith('package.json') && activeChecks.has(uri)) {
			triggerUpdateDecorations(event.document, styles);
		}
	}));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && editor.document.languageId === 'json' && editor.document.fileName.endsWith('package.json')) {
			if (activeChecks.has(editor.document.uri.toString())) {
				triggerUpdateDecorations(editor.document, styles);
				return;
			}
		}

		void vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
	}));

	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
		if (!document.fileName.endsWith('package.json')) {
			return;
		}

		const uri = document.uri.toString();
		const timer = debounceTimers.get(uri);
		if (timer) {
			clearTimeout(timer);
		}
		debounceTimers.delete(uri);
		activeChecks.delete(uri);
		clearDecorationRuns(uri);
		clearPackageState(uri);
		void vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
	}));

	context.subscriptions.push(styles);
}

function triggerUpdateDecorations(document: vscode.TextDocument, styles: VersionDecorationStyles): void {
	const key = document.uri.toString();
	const existing = debounceTimers.get(key);
	if (existing) {
		clearTimeout(existing);
	}

	debounceTimers.set(key, setTimeout(() => {
		debounceTimers.delete(key);
		updateDecorations(document, styles).catch(console.error);
	}, DEBOUNCE_MS));
}

export function deactivate(): void {
	debounceTimers.forEach(timer => clearTimeout(timer));
	debounceTimers.clear();
	activeChecks.clear();
	clearDecorationRuns();
	clearVersionCache();
	clearPackageState();
}

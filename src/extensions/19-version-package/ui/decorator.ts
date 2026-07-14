import * as vscode from 'vscode';
import { parsePackageJson } from '../core/parser';
import { getDocumentCache } from '../core/state';
import { fetchPackageLatestVersion, VersionInfo } from '../core/versionFetcher';
import { canUpdateVersionString, getVersionStatus, VersionStatus } from '../core/versionStatus';
import { VersionDecorationStyles } from './styles';

const updateRuns = new Map<string, number>();
let nextUpdateRun = 0;

interface DecorationGroups {
	updateAvailable: vscode.DecorationOptions[];
	updateRecommended: vscode.DecorationOptions[];
	upToDate: vscode.DecorationOptions[];
	error: vscode.DecorationOptions[];
	safeUpdates: number;
}

export function clearDecorationRuns(uri?: string): void {
	if (uri) {
		updateRuns.delete(uri);
	} else {
		updateRuns.clear();
	}
}

export async function clearDecorations(editor: vscode.TextEditor, styles: VersionDecorationStyles): Promise<void> {
	editor.setDecorations(styles.updateAvailable, []);
	editor.setDecorations(styles.updateRecommended, []);
	editor.setDecorations(styles.upToDate, []);
	editor.setDecorations(styles.loading, []);
	editor.setDecorations(styles.error, []);
	await vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
}

export async function updateDecorations(document: vscode.TextDocument, styles: VersionDecorationStyles): Promise<void> {
	const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document === document);
	if (!editor) {
		return;
	}

	const uri = document.uri.toString();
	const run = ++nextUpdateRun;
	const documentVersion = document.version;
	updateRuns.set(uri, run);

	const dependencies = parsePackageJson(document);
	const documentCache = getDocumentCache(uri);
	const currentLines = new Map(dependencies.map(dep => [dep.line, dep]));

	for (const [line, state] of documentCache) {
		const dependency = currentLines.get(line);
		if (!dependency || dependency.name !== state.name || dependency.currentVersion !== state.currentVersion) {
			documentCache.delete(line);
		}
	}

	const dependenciesToFetch = dependencies.filter(dep => !documentCache.has(dep.line));
	const loadingOptions = dependenciesToFetch.map(dep => createDecoration(dep.line, 'checking...'));
	const groups: DecorationGroups = {
		updateAvailable: [],
		updateRecommended: [],
		upToDate: [],
		error: [],
		safeUpdates: 0
	};

	for (const dep of dependencies) {
		const state = documentCache.get(dep.line);
		if (state) {
			classifyDecoration(dep.line, dep.currentVersion, state.info, groups);
		}
	}

	paintDecorations(editor, styles, loadingOptions, groups);
	if (dependenciesToFetch.length === 0) {
		await setUpdateContext(document, groups);
		return;
	}

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Window,
		title: 'Fetching package versions...'
	}, async () => {
		await Promise.all(dependenciesToFetch.map(async dep => {
			const info = await fetchPackageLatestVersion(dep.name, dep.currentVersion);
			if (updateRuns.get(uri) !== run || document.version !== documentVersion) {
				return;
			}

			const loadingIndex = loadingOptions.findIndex(option => option.range.start.line === dep.line);
			if (loadingIndex >= 0) {
				loadingOptions.splice(loadingIndex, 1);
			}

			if (info.error) {
				groups.error.push(createDecoration(dep.line, 'Check failed'));
			} else {
				documentCache.set(dep.line, {
					name: dep.name,
					currentVersion: dep.currentVersion,
					line: dep.line,
					info
				});
				classifyDecoration(dep.line, dep.currentVersion, info, groups);
			}

			paintDecorations(editor, styles, loadingOptions, groups);
		}));

		if (updateRuns.get(uri) === run && document.version === documentVersion) {
			await setUpdateContext(document, groups);
		}
	});
}

function classifyDecoration(line: number, currentVersion: string, info: VersionInfo, groups: DecorationGroups): void {
	const status = getVersionStatus(currentVersion, info);
	const decoration = createDecoration(line, getStatusLabel(status));
	if (status.safeTarget && canUpdateVersionString(currentVersion)) {
		groups.safeUpdates++;
	}

	switch (status.kind) {
		case 'latest':
		case 'newer':
			groups.upToDate.push(decoration);
			break;
		case 'major':
		case 'breaking':
			groups.updateAvailable.push(decoration);
			break;
		case 'update':
			groups.updateRecommended.push(decoration);
			break;
		case 'unknown':
			groups.error.push(decoration);
	}
}

function getStatusLabel(status: VersionStatus): string {
	switch (status.kind) {
		case 'latest': return '✓ latest';
		case 'newer': return '✓ newer than latest';
		case 'major': return `Major → ${status.target}`;
		case 'breaking': return `Breaking → ${status.target}`;
		case 'update': return `Update → ${status.target}`;
		case 'unknown': return 'Version unavailable';
	}
}

function createDecoration(line: number, contentText: string): vscode.DecorationOptions {
	return {
		range: new vscode.Range(line, Number.MAX_VALUE, line, Number.MAX_VALUE),
		renderOptions: { after: { contentText } }
	};
}

function paintDecorations(
	editor: vscode.TextEditor,
	styles: VersionDecorationStyles,
	loading: vscode.DecorationOptions[],
	groups: DecorationGroups
): void {
	editor.setDecorations(styles.loading, loading);
	editor.setDecorations(styles.updateAvailable, groups.updateAvailable);
	editor.setDecorations(styles.updateRecommended, groups.updateRecommended);
	editor.setDecorations(styles.upToDate, groups.upToDate);
	editor.setDecorations(styles.error, groups.error);
}

async function setUpdateContext(document: vscode.TextDocument, groups: DecorationGroups): Promise<void> {
	if (vscode.window.activeTextEditor?.document !== document) {
		return;
	}

	await vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', groups.safeUpdates > 0);
}

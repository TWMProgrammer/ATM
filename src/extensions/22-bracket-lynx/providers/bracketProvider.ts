import * as vscode from 'vscode';
import { parseBrackets } from '../core/parser';
import { getCachedBrackets, setCachedBrackets, clearAllCache } from '../core/cache';
import { getBracketDecorationSources, filterContent } from '../core/formatter';
import { SUPPORTED_LANGUAGES, ALLOWED_JSON_FILES, DEFAULT_COLOR, DEFAULT_FONT_STYLE } from '../core/constants';
import { isAllowedJsonFile } from '../utils/text';

const editorDecorations = new Map<vscode.TextEditor, vscode.TextEditorDecorationType>();

function shouldProcessDocument(document: vscode.TextDocument): boolean {
	if (document.languageId === 'json') {
		return isAllowedJsonFile(document.fileName, ALLOWED_JSON_FILES);
	}
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(document.languageId);
}

export function updateBracketDecorations(editor: vscode.TextEditor): void {
	if (!shouldProcessDocument(editor.document)) {
		clearBracketDecorations(editor);
		return;
	}

	let brackets = getCachedBrackets(editor.document);
	if (!brackets) {
		brackets = parseBrackets(editor.document);
		setCachedBrackets(editor.document, brackets);
	}

	const sources = getBracketDecorationSources(editor.document, brackets);
	const activeLine = editor.selection.active.line;

	const options: vscode.DecorationOptions[] = [];
	for (const source of sources) {
		if (source.range.start.line === activeLine) {
			continue;
		}
		const filtered = filterContent(source.bracketHeader);
		if (filtered.trim().length === 0) {
			continue;
		}
		options.push({
			range: source.range,
			renderOptions: {
				after: {
					contentText: filtered,
					color: DEFAULT_COLOR,
					fontStyle: DEFAULT_FONT_STYLE,
				},
			},
		});
	}

	let decorationType = editorDecorations.get(editor);
	if (!decorationType) {
		decorationType = vscode.window.createTextEditorDecorationType({
			isWholeLine: true,
		});
		editorDecorations.set(editor, decorationType);
	}

	editor.setDecorations(decorationType, options);
}

export function clearBracketDecorations(editor: vscode.TextEditor): void {
	const decorationType = editorDecorations.get(editor);
	if (decorationType) {
		editor.setDecorations(decorationType, []);
	}
}

export function clearAllBracketDecorations(): void {
	for (const [editor, decorationType] of editorDecorations) {
		editor.setDecorations(decorationType, []);
	}
}

export function disposeBracketDecorations(): void {
	for (const decorationType of editorDecorations.values()) {
		decorationType.dispose();
	}
	editorDecorations.clear();
}

export function refreshBracketDecorations(): void {
	clearAllCache();
	for (const editor of vscode.window.visibleTextEditors) {
		updateBracketDecorations(editor);
	}
}

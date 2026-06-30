import * as vscode from 'vscode';
import { FRAMEWORK_CONFIGS } from '../core/constants';
import { getColor, getFontStyle, getMaxDecorationsPerFile, getMinBracketScopeLines, getPrefix } from '../core/config';
import type { ComponentRange, FrameworkConfig } from '../core/types';

const editorDecorations = new Map<vscode.TextEditor, vscode.TextEditorDecorationType>();

const OPEN_TAG_REGEX = /<([a-zA-Z][a-zA-Z0-9:-]*)(?:\s+[^>]*)?>/;
const CLOSE_TAG_REGEX = /<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/;
const SELF_CLOSING_REGEX = /<[a-zA-Z][a-zA-Z0-9:-]*[^>]*\/>/;
const SCOPED_STYLE_REGEX = /<style[^>]*\sscoped[^>]*>/;

export function detectFramework(document: vscode.TextDocument): keyof typeof FRAMEWORK_CONFIGS | null {
	for (const [key, config] of Object.entries(FRAMEWORK_CONFIGS)) {
		if (config.extensions.some((ext) => document.fileName.endsWith(ext))) {
			return key as keyof typeof FRAMEWORK_CONFIGS;
		}
		if (config.languageIds.includes(document.languageId)) {
			return key as keyof typeof FRAMEWORK_CONFIGS;
		}
	}
	return null;
}

function isTargetElement(tagName: string, config: FrameworkConfig): boolean {
	const lower = tagName.toLowerCase();
	return (
		config.components.includes(lower) ||
		config.htmlElements.includes(lower) ||
		(tagName.length > 0 && tagName[0] === tagName[0].toUpperCase())
	);
}

function isStyleScoped(lines: readonly string[], startIndex: number): boolean {
	const openingLine = lines[startIndex]?.trim();
	return openingLine ? SCOPED_STYLE_REGEX.test(openingLine) : false;
}

function hasSignificantContent(lines: readonly string[], startIndex: number, endIndex: number): boolean {
	if (endIndex - startIndex < 2) {
		return false;
	}

	for (let i = startIndex + 1; i < endIndex; i++) {
		const content = lines[i]?.trim();
		if (content && content !== '{' && content !== '}' && content !== '<!--' && content !== '-->') {
			return true;
		}
	}
	return false;
}

function findComponentRanges(lines: readonly string[], config: FrameworkConfig): ComponentRange[] {
	const stack: { name: string; startLine: number }[] = [];
	const ranges: ComponentRange[] = [];
	const minLines = Math.max(1, getMinBracketScopeLines() - 2);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) {
			continue;
		}

		const trimmed = line.trim();
		if (trimmed.startsWith('<!--') || trimmed.startsWith('//')) {
			continue;
		}
		if (SELF_CLOSING_REGEX.test(trimmed)) {
			continue;
		}

		const openMatch = trimmed.match(OPEN_TAG_REGEX);
		if (openMatch) {
			const tagName = openMatch[1]!;
			if (isTargetElement(tagName, config)) {
				stack.push({ name: tagName, startLine: i + 1 });
			}
			continue;
		}

		const closeMatch = trimmed.match(CLOSE_TAG_REGEX);
		if (closeMatch) {
			const tagName = closeMatch[1]!;
			for (let j = stack.length - 1; j >= 0; j--) {
				if (stack[j]!.name.toLowerCase() === tagName.toLowerCase()) {
					const open = stack[j]!;
					stack.splice(j, 1);
					const lineSpan = i + 1 - open.startLine;
					if (lineSpan >= minLines && hasSignificantContent(lines, open.startLine - 1, i)) {
						ranges.push({
							name: open.name,
							startLine: open.startLine,
							endLine: i + 1,
							range: new vscode.Range(i, line.length, i, line.length),
							hasContent: true,
							isScoped: config.hasScoped && open.name.toLowerCase() === 'style' && isStyleScoped(lines, open.startLine - 1),
						});
					}
					break;
				}
			}
		}
	}

	return ranges;
}

export function updateFrameworkDecorations(editor: vscode.TextEditor): void {
	const framework = detectFramework(editor.document);
	if (!framework) {
		clearFrameworkDecorations(editor);
		return;
	}

	const config = FRAMEWORK_CONFIGS[framework];
	const text = editor.document.getText();
	const lines = text.split('\n');
	const ranges = findComponentRanges(lines, config);

	const prefix = getPrefix();
	const color = getColor();
	const fontStyle = getFontStyle();
	const maxDecorations = getMaxDecorationsPerFile();

	const decorations: vscode.DecorationOptions[] = [];
	for (const range of ranges.slice(0, maxDecorations)) {
		const scopedIndicator = range.isScoped ? ' [scoped]' : '';
		const decorationText = `${prefix}#${range.startLine}-${range.endLine} ${range.name}${scopedIndicator}`;
		decorations.push({
			range: range.range,
			renderOptions: {
				after: {
					contentText: decorationText,
					color,
					fontStyle,
				},
			},
		});
	}

	let decorationType = editorDecorations.get(editor);
	if (!decorationType) {
		decorationType = vscode.window.createTextEditorDecorationType({});
		editorDecorations.set(editor, decorationType);
	}

	editor.setDecorations(decorationType, decorations);
}

export function clearFrameworkDecorations(editor: vscode.TextEditor): void {
	const decorationType = editorDecorations.get(editor);
	if (decorationType) {
		editor.setDecorations(decorationType, []);
	}
}

export function clearAllFrameworkDecorations(): void {
	for (const [editor, decorationType] of editorDecorations) {
		editor.setDecorations(decorationType, []);
	}
}

export function disposeFrameworkDecorations(): void {
	for (const decorationType of editorDecorations.values()) {
		decorationType.dispose();
	}
	editorDecorations.clear();
}

import * as vscode from 'vscode';
import type { BracketContext, BracketEntry } from './types';
import {
	DEFAULT_PREFIX,
	DEFAULT_LANGUAGE_CONFIGURATION,
	EXCLUDED_SYMBOLS,
	FUNCTION_SYMBOLS,
	PERFORMANCE_LIMITS,
	getLanguageSpecificConfig,
} from './constants';
import { escapeRegExp, normalizeWhitespace, truncateText } from '../utils/text';
import { nextCharacter, nextLine, maxPosition, minPosition } from '../utils/position';

const excludedSymbolsSet = new Set<string>(EXCLUDED_SYMBOLS);
const symbolReplacerRegex = new RegExp(`(${EXCLUDED_SYMBOLS.map(escapeRegExp).join('|')})`, 'g');

const skipWords = new Set(['export', 'const', 'function', 'async', 'default', 'let', 'var', 'return']);

export function filterContent(content: string): string {
	if (!content) {
		return '';
	}
	return content.replace(symbolReplacerRegex, ' ').replace(/\s+/g, ' ').trim();
}

export function shouldExcludeSymbol(symbol: string): boolean {
	return excludedSymbolsSet.has(symbol);
}

function getFirstMeaningfulWord(words: string[]): string {
	for (const word of words) {
		const clean = word.toLowerCase().trim();
		if (clean && !skipWords.has(clean)) {
			return word;
		}
	}
	return words[0] ?? '';
}

function detectArrowFunctionType(text: string): 'normal' | 'collection' | null {
	if (!text.includes('=>')) {
		return null;
	}

	const lower = text.toLowerCase();
	if (lower.includes('export') || lower.includes('const') || lower.includes('let') || lower.includes('var')) {
		return 'normal';
	}
	if (lower.includes(':')) {
		return 'collection';
	}
	return null;
}

function formatArrowFunction(text: string): string | null {
	const type = detectArrowFunctionType(text);
	if (!type) {
		return null;
	}

	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		return null;
	}

	if (type === 'normal') {
		const firstTwo = words.slice(0, 2).join(' ');
		return `${firstTwo || words[0]} ${FUNCTION_SYMBOLS.NORMAL_ARROW}`;
	}

	return `${getFirstMeaningfulWord(words)} ${FUNCTION_SYMBOLS.COLLECTION_ARROW}`;
}

function isAsyncFunction(text: string): boolean {
	const lower = text.toLowerCase();
	return (lower.includes('async function') || lower.includes('async ')) && !lower.includes('=>');
}

function isComplexFunction(text: string): boolean {
	const lower = text.toLowerCase();
	return (
		(lower.includes('function ') || (lower.includes('export') && lower.includes('function'))) &&
		(lower.includes('react.') || lower.includes('svgprops') || lower.includes('htmlprops') ||
			(lower.includes('<') && lower.includes('>'))) &&
		!lower.includes('async') &&
		!lower.includes('=>')
	);
}

function formatFunction(words: string[], symbol: string): string {
	if (words.length >= 3) {
		return `${words.slice(0, 2).join(' ')} ${symbol}`;
	}
	if (words.length === 2) {
		return `${words.join(' ')} ${symbol}`;
	}
	if (words.length === 1) {
		return `${words[0]} ${symbol}`;
	}
	return words.join(' ');
}

function applyWordLimit(text: string): string {
	if (!text) {
		return '';
	}

	const lower = text.toLowerCase();
	const words = text.split(/\s+/).filter(Boolean);

	if (isAsyncFunction(lower)) {
		return formatFunction(words, FUNCTION_SYMBOLS.ASYNC_FUNCTION);
	}
	if (isComplexFunction(lower)) {
		return formatFunction(words, FUNCTION_SYMBOLS.COMPLEX_FUNCTION);
	}

	const arrowResult = formatArrowFunction(text);
	if (arrowResult) {
		return arrowResult;
	}

	const maxWords = 1;
	if (words.length > maxWords) {
		return words.slice(0, maxWords).join(' ') + '...';
	}

	return words.join(' ');
}

function formatTSX(context: string): string {
	let result = context;

	const jsxTagMatch = result.match(/<\s*([a-zA-Z][a-zA-Z0-9-]*)[^>]*/);
	if (jsxTagMatch) {
		const tagName = jsxTagMatch[1]!.toLowerCase();
		if (tagName === 'image' || tagName === 'img') {
			return 'img';
		}
		if (['div', 'span', 'input'].includes(tagName)) {
			return tagName;
		}
		if (tagName === 'button') {
			return 'btn';
		}
		return tagName;
	}

	const jsxClosingTagMatch = result.match(/<\/\s*([a-zA-Z][a-zA-Z0-9-]*)\s*>/);
	if (jsxClosingTagMatch) {
		const tagName = jsxClosingTagMatch[1]!.toLowerCase();
		return tagName === 'image' || tagName === 'img' ? 'img' : tagName;
	}

	result = result.replace(/:\s*\{[^}]*\}/g, '');
	result = result.replace(/\{[^}]*\}/g, '').trim();
	result = result.replace(/\s+/g, ' ').trim();
	result = result.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/g, '$1 ()=>');
	result = result.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*=>/g, '$1 ()=>');

	if (result.includes('export')) {
		result = result.replace(/export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*/i, 'export $1');
		result = result.replace(/export\s+(function|interface|type|class|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i, 'export $2');
		result = result.replace(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/i, 'export $1');
	} else {
		result = result.replace(/^export\s+(const\s+|function\s+|interface\s+|type\s+|class\s+|enum\s+|default\s+)?/i, '');
	}

	return result.replace(/\s+/g, ' ').trim();
}

function looksLikeCSS(context: string): boolean {
	const trimmed = context.trim();
	if (trimmed.length < 2) {
		return false;
	}
	const patterns = [/^[.#][\w-]+/, /[\w-]+\s*:\s*[\w-]+/, /^@[\w-]+/, /\.([\w-]+)\s*\{/, /#([\w-]+)\s*\{/];
	if (patterns.some((p) => p.test(trimmed))) {
		return true;
	}
	const selectorCount = (trimmed.match(/[.#]/g) ?? []).length;
	return selectorCount >= 2 && trimmed.includes(' ');
}

function formatCSS(context: string): string {
	let result = context;
	result = result.replace(/:\s*[\w#%-]+(?:\s*!important)?/g, '');
	result = result.replace(/[,;]/g, '');
	result = result.replace(/[.#]/g, '');
	result = result.replace(/\s+/g, ' ').trim();
	result = result.replace(/@[\w-]+\s*/g, '');
	result = result.replace(/::?[\w-]+(?:\([^)]*\))?/g, '');

	const parts = result.split(' ').filter((part) => part.length > 0);
	if (parts.length === 0) {
		return '';
	}
	if (parts.length === 1) {
		return parts[0]!;
	}
	if (parts.length === 2) {
		return `${parts[0]} •${parts[1]}`;
	}
	return `${parts[0]} •${parts[parts.length - 1]}`;
}

function formatContext(contextInfo: string, languageId: string): string {
	if (!contextInfo) {
		return '';
	}

	let filtered = filterContent(contextInfo);
	if (!filtered.trim()) {
		return '';
	}

	if (looksLikeCSS(filtered)) {
		return formatCSS(filtered);
	}

	switch (languageId) {
		case 'typescript':
		case 'typescriptreact':
		case 'javascript':
		case 'javascriptreact':
		case 'html':
		case 'astro':
		case 'vue':
		case 'svelte':
			return formatTSX(filtered);
		case 'css':
		case 'scss':
			return formatCSS(filtered);
		default:
			return filtered;
	}
}

function getBeforeHeader(
	document: vscode.TextDocument,
	context: BracketContext,
	regulateHeader: (text: string) => string,
	isValidHeader: (text: string) => boolean,
): string | null {
	const terminators = getLanguageSpecificConfig(document.languageId).terminators ?? DEFAULT_LANGUAGE_CONFIGURATION.terminators;
	const topLimit =
		context.previousEntry?.end.position ??
		(context.parentEntry
			? nextCharacter(context.parentEntry.start.position, context.parentEntry.start.token.length)
			: new vscode.Position(0, 0));

	const lineHead = maxPosition([topLimit, nextLine(context.entry.start.position, 0)]);
	const currentLineHeader = regulateHeader(document.getText(new vscode.Range(lineHead, context.entry.start.position)));
	if (isValidHeader(currentLineHeader) && !terminators.some((t) => currentLineHeader.endsWith(t))) {
		return currentLineHeader;
	}

	if (topLimit.line < context.entry.start.position.line) {
		const previousLineHead = maxPosition([topLimit, nextLine(context.entry.start.position, -1)]);
		const previousLineHeader = regulateHeader(document.getText(new vscode.Range(previousLineHead, lineHead)));
		if (isValidHeader(previousLineHeader) && !terminators.some((t) => previousLineHeader.endsWith(t))) {
			return previousLineHeader;
		}
	}

	return null;
}

function getInnerHeader(
	document: vscode.TextDocument,
	context: BracketContext,
	regulateHeader: (text: string) => string,
	isValidHeader: (text: string) => boolean,
): string | null {
	const currentLineInnerHeader = regulateHeader(
		document.getText(new vscode.Range(context.entry.start.position, nextLine(context.entry.start.position, 1))),
	);
	if (isValidHeader(currentLineInnerHeader) && currentLineInnerHeader !== regulateHeader(context.entry.start.token)) {
		return currentLineInnerHeader;
	}

	const innerHeader = regulateHeader(
		document.getText(
			new vscode.Range(
				context.entry.start.position,
				minPosition([nextLine(context.entry.start.position, 16), context.entry.end.position]),
			),
		),
	);
	if (isValidHeader(innerHeader)) {
		return innerHeader;
	}

	return null;
}

function getBracketHeader(document: vscode.TextDocument, context: BracketContext): string {
	const maxLength = PERFORMANCE_LIMITS.MAX_HEADER_LENGTH;
	const regulateHeader = (text: string): string => {
		let result = normalizeWhitespace(text);
		result = formatContext(result, document.languageId);
		result = applyWordLimit(result);
		return truncateText(result, maxLength);
	};

	const isValidHeader = (text: string): boolean => text.replace(/,/g, '').trim().length > 0;

	if (context.entry.headerMode !== 'inner') {
		const header = getBeforeHeader(document, context, regulateHeader, isValidHeader);
		if (header) {
			return header;
		}
	}

	if (context.entry.headerMode !== 'before') {
		const header = getInnerHeader(document, context, regulateHeader, isValidHeader);
		if (header) {
			return header;
		}
	}

	return '';
}

export function getBracketDecorationSources(
	document: vscode.TextDocument,
	brackets: BracketEntry[],
): { range: vscode.Range; bracketHeader: string }[] {
	const prefix = DEFAULT_PREFIX;
	const unmatchPrefix = DEFAULT_PREFIX;
	const minLines = PERFORMANCE_LIMITS.MIN_BRACKET_SCOPE_LINES;
	const maxDecorations = PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE;
	const result: { range: vscode.Range; bracketHeader: string }[] = [];

	function getLineNumbers(entry: BracketEntry): string {
		return `#${entry.start.position.line + 1}-${entry.end.position.line + 1} `;
	}

	function scanner(context: BracketContext): void {
		const lineSpan = context.entry.end.position.line - context.entry.start.position.line + 1;
		if (lineSpan < minLines) {
			return;
		}

		if (
			context.entry.end.position.line < (context.nextEntry?.start.position.line ?? document.lineCount + 1) &&
			context.entry.end.position.line < (context.parentEntry?.end.position.line ?? document.lineCount + 1)
		) {
			const decorationRange = new vscode.Range(
				nextCharacter(context.entry.end.position, -context.entry.end.token.length),
				context.entry.end.position,
			);

			const bracketHeader = getBracketHeader(document, context);
			if (bracketHeader.length > 0) {
				const lineNumbers = getLineNumbers(context.entry);
				const prefixText = context.entry.isUnmatchBrackets ? unmatchPrefix : prefix;
				result.push({
					range: decorationRange,
					bracketHeader: `${prefixText}${lineNumbers}•${bracketHeader}`,
				});
			}
		}

		context.entry.items.forEach((entry, index, array) =>
			scanner({
				parentEntry: context.entry,
				previousEntry: array[index - 1],
				entry,
				nextEntry: array[index + 1],
			}),
		);
	}

	brackets.forEach((entry, index, array) =>
		scanner({
			parentEntry: undefined,
			previousEntry: array[index - 1],
			entry,
			nextEntry: array[index + 1],
		}),
	);

	if (result.length > maxDecorations) {
		return result
			.sort((a, b) => {
				const aUnmatched = a.bracketHeader.includes(unmatchPrefix);
				const bUnmatched = b.bracketHeader.includes(unmatchPrefix);
				if (aUnmatched && !bUnmatched) {
					return -1;
				}
				if (!aUnmatched && bUnmatched) {
					return 1;
				}
				return a.bracketHeader.length - b.bracketHeader.length;
			})
			.slice(0, maxDecorations);
	}

	return result;
}

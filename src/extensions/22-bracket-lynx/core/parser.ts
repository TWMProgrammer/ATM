import * as vscode from 'vscode';
import type { BracketEntry, HeaderMode, LanguageConfiguration, TokenEntry } from './types';
import { getLanguageSpecificConfig, getMaxFileSize, isPerformanceFiltersEnabled } from './config';
import { PERFORMANCE_LIMITS, PROBLEMATIC_EXTENSIONS, PROBLEMATIC_LANGUAGES } from './constants';
import { isMinifiedFile } from '../utils/text';
import { makeRegExpPart, regExpExecToArray } from '../utils/regex';

interface TokenConfig {
	openingBlockComments: string[];
	closingBlockComments: string[];
	lineComments: string[];
	openingSymbolBrackets: string[];
	closingSymbolBrackets: string[];
	symbolBracketsHeader: HeaderMode[];
	openingWordBrackets: string[];
	closingWordBrackets: string[];
	wordBracketsHeader: HeaderMode[];
	openingInlineStrings: string[];
	closingInlineStrings: string[];
	openingMultilineStrings: string[];
	closingMultilineStrings: string[];
	ignoreSymbols: string[];
}

export function shouldSkipDocument(document: vscode.TextDocument): boolean {
	if (!isPerformanceFiltersEnabled()) {
		return false;
	}

	const text = document.getText();
	const fileSize = text.length;

	if (fileSize > getMaxFileSize()) {
		return true;
	}

	if (fileSize > PERFORMANCE_LIMITS.MAX_FILE_SIZE * 4) {
		return true;
	}

	if (isMinifiedFile(document.fileName)) {
		return true;
	}

	const avgLineLength = fileSize / Math.max(1, document.lineCount);
	if (avgLineLength > 500) {
		return true;
	}

	return false;
}

export function isProblematicDocument(document: vscode.TextDocument): boolean {
	if (PROBLEMATIC_LANGUAGES.includes(document.languageId as never)) {
		return true;
	}

	const lowerFileName = document.fileName.toLowerCase();
	if (PROBLEMATIC_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))) {
		return true;
	}

	return false;
}

function extractLanguageTokens(languageConfiguration: LanguageConfiguration): TokenConfig {
	const regulate = languageConfiguration.ignoreCase
		? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
		: (text: string) => text.replace(/\s+/, ' ');

	return {
		openingBlockComments: languageConfiguration.comments?.block?.map((i) => regulate(i.opening)) ?? [],
		closingBlockComments: languageConfiguration.comments?.block?.map((i) => regulate(i.closing)) ?? [],
		lineComments: languageConfiguration.comments?.line?.map(regulate) ?? [],
		openingSymbolBrackets: languageConfiguration.brackets?.symbol?.map((i) => regulate(i.opening)) ?? [],
		closingSymbolBrackets: languageConfiguration.brackets?.symbol?.map((i) => regulate(i.closing)) ?? [],
		symbolBracketsHeader: languageConfiguration.brackets?.symbol?.map((i) => i.headerMode ?? 'smart') ?? [],
		openingWordBrackets: languageConfiguration.brackets?.word?.map((i) => regulate(i.opening)) ?? [],
		closingWordBrackets: languageConfiguration.brackets?.word?.map((i) => regulate(i.closing)) ?? [],
		wordBracketsHeader: languageConfiguration.brackets?.word?.map((i) => i.headerMode ?? 'inner') ?? [],
		openingInlineStrings: languageConfiguration.strings?.inline?.map((i) => regulate(i.opening)) ?? [],
		closingInlineStrings: languageConfiguration.strings?.inline?.map((i) => regulate(i.closing)) ?? [],
		openingMultilineStrings: languageConfiguration.strings?.multiline?.map((i) => regulate(i.opening)) ?? [],
		closingMultilineStrings: languageConfiguration.strings?.multiline?.map((i) => regulate(i.closing)) ?? [],
		ignoreSymbols: languageConfiguration.ignoreSymbols?.map(regulate) ?? [],
	};
}

function createTokenPattern(tokens: string[]): string {
	return tokens
		.filter((entry, index, array) => entry !== '' && index === array.indexOf(entry))
		.map((i) => makeRegExpPart(i))
		.join('|');
}

function tokenizeDocument(text: string, pattern: string, ignoreCase: boolean): { index: number; token: string }[] {
	if (!pattern) {
		return [];
	}

	const regex = new RegExp(pattern, ignoreCase ? 'gui' : 'gu');
	return regExpExecToArray(regex, text).map((match) => ({
		index: match.index,
		token: match[0],
	}));
}

function isInlineScope(bracket: BracketEntry): boolean {
	return bracket.end.position.line <= bracket.start.position.line;
}

export function parseBrackets(document: vscode.TextDocument): BracketEntry[] {
	if (shouldSkipDocument(document)) {
		return [];
	}

	const languageConfiguration = getLanguageSpecificConfig(document.languageId);
	const tokenConfig = extractLanguageTokens(languageConfiguration);
	const regulate = languageConfiguration.ignoreCase
		? (text: string) => text.replace(/\s+/, ' ').toLowerCase()
		: (text: string) => text.replace(/\s+/, ' ');

	const pattern = createTokenPattern([
		...tokenConfig.ignoreSymbols,
		...tokenConfig.openingBlockComments,
		...tokenConfig.closingBlockComments,
		...tokenConfig.lineComments,
		...tokenConfig.openingSymbolBrackets,
		...tokenConfig.closingSymbolBrackets,
		...tokenConfig.openingWordBrackets,
		...tokenConfig.closingWordBrackets,
		...tokenConfig.openingInlineStrings,
		...tokenConfig.closingInlineStrings,
		...tokenConfig.openingMultilineStrings,
		...tokenConfig.closingMultilineStrings,
	]);

	const text = document.getText();
	const tokens = tokenizeDocument(text, pattern, languageConfiguration.ignoreCase);
	return parseTokens(document, text, tokens, regulate, tokenConfig);
}

interface ScopeStackEntry {
	start: TokenEntry;
	closing: string;
	headerMode: HeaderMode;
	items: BracketEntry[];
}

function parseTokens(
	document: vscode.TextDocument,
	text: string,
	tokens: { index: number; token: string }[],
	regulate: (text: string) => string,
	tokenConfig: TokenConfig,
): BracketEntry[] {
	const result: BracketEntry[] = [];
	const scopeStack: ScopeStackEntry[] = [];

	function writeCore(entry: BracketEntry): void {
		if (!isInlineScope(entry) || entry.isUnmatchBrackets) {
			const parent = scopeStack[scopeStack.length - 1];
			if (parent) {
				parent.items.push(entry);
			} else {
				result.push(entry);
			}
		}
	}

	function write(closingToken: { index: number; token: string }): void {
		const scope = scopeStack.pop();
		if (scope) {
			writeCore({
				start: scope.start,
				end: {
					position: document.positionAt(closingToken.index + closingToken.token.length),
					token: closingToken.token,
				},
				headerMode: scope.headerMode,
				isUnmatchBrackets: scope.closing !== regulate(closingToken.token),
				items: scope.items,
			});
		} else {
			writeCore({
				start: {
					position: document.positionAt(closingToken.index),
					token: closingToken.token,
				},
				end: {
					position: document.positionAt(closingToken.index + closingToken.token.length),
					token: closingToken.token,
				},
				headerMode: 'smart',
				isUnmatchBrackets: true,
				items: [],
			});
		}
	}

	let i = 0;
	while (i < tokens.length) {
		const tokenData = tokens[i]!;
		const token = regulate(tokenData.token);

		const blockCommentIndex = tokenConfig.openingBlockComments.indexOf(token);
		if (blockCommentIndex >= 0) {
			const closing = tokenConfig.closingBlockComments[blockCommentIndex];
			while (++i < tokens.length) {
				if (closing === regulate(tokens[i]!.token)) {
					i++;
					break;
				}
			}
			continue;
		}

		if (tokenConfig.lineComments.includes(token)) {
			const line = document.positionAt(tokenData.index).line;
			while (++i < tokens.length) {
				if (line !== document.positionAt(tokens[i]!.index).line) {
					break;
				}
			}
			continue;
		}

		const openingSymbolIndex = tokenConfig.openingSymbolBrackets.indexOf(token);
		if (openingSymbolIndex >= 0) {
			scopeStack.push({
				start: {
					position: document.positionAt(tokenData.index),
					token: tokenData.token,
				},
				closing: tokenConfig.closingSymbolBrackets[openingSymbolIndex]!,
				headerMode: tokenConfig.symbolBracketsHeader[openingSymbolIndex]!,
				items: [],
			});
			i++;
			continue;
		}

		const openingWordIndex = tokenConfig.openingWordBrackets.indexOf(token);
		if (openingWordIndex >= 0 && isWordBoundary(document, tokenData)) {
			scopeStack.push({
				start: {
					position: document.positionAt(tokenData.index),
					token: tokenData.token,
				},
				closing: tokenConfig.closingWordBrackets[openingWordIndex]!,
				headerMode: tokenConfig.wordBracketsHeader[openingWordIndex]!,
				items: [],
			});
			i++;
			continue;
		}

		if (
			tokenConfig.closingSymbolBrackets.indexOf(token) >= 0 ||
			(tokenConfig.closingWordBrackets.indexOf(token) >= 0 && isWordBoundary(document, tokenData))
		) {
			write(tokenData);
			i++;
			continue;
		}

		const inlineStringIndex = tokenConfig.openingInlineStrings.indexOf(token);
		if (inlineStringIndex >= 0) {
			const line = document.positionAt(tokenData.index).line;
			const closing = tokenConfig.closingInlineStrings[inlineStringIndex];
			while (++i < tokens.length) {
				const nextToken = tokens[i]!;
				if (line !== document.positionAt(nextToken.index).line) {
					break;
				}
				if (closing === regulate(nextToken.token)) {
					i++;
					break;
				}
			}
			continue;
		}

		const multilineStringIndex = tokenConfig.openingMultilineStrings.indexOf(token);
		if (multilineStringIndex >= 0) {
			const closing = tokenConfig.closingMultilineStrings[multilineStringIndex];
			while (++i < tokens.length) {
				if (closing === regulate(tokens[i]!.token)) {
					i++;
					break;
				}
			}
			continue;
		}

		i++;
	}

	while (scopeStack.length > 0) {
		write({ index: text.length, token: '' });
	}

	return result;
}

function isWordBoundary(
	document: vscode.TextDocument,
	tokenData: { index: number; token: string },
): boolean {
	const text = document.getText();
	const prevChar = tokenData.index > 0 ? text[tokenData.index - 1] : '';
	const nextChar = tokenData.index + tokenData.token.length < text.length
		? text[tokenData.index + tokenData.token.length]
		: '';
	return !(/\w/.test(prevChar ?? '')) && !(/\w/.test(nextChar ?? ''));
}

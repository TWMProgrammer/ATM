import type * as vscode from 'vscode';
import type { BracketEntry } from './types';
import { CACHE_CONFIG } from './constants';

interface CacheEntry {
	brackets: BracketEntry[];
	version: number;
	timestamp: number;
	size: number;
}

const documentCache = new Map<string, CacheEntry>();

export function getCacheKey(document: vscode.TextDocument): string {
	return `${document.uri.toString()}|${document.version}`;
}

export function getCachedBrackets(document: vscode.TextDocument): BracketEntry[] | undefined {
	const key = getCacheKey(document);
	const entry = documentCache.get(key);

	if (!entry) {
		return undefined;
	}

	if (Date.now() - entry.timestamp > CACHE_CONFIG.DOCUMENT_CACHE_TTL_MS) {
		documentCache.delete(key);
		return undefined;
	}

	return entry.brackets;
}

export function setCachedBrackets(document: vscode.TextDocument, brackets: BracketEntry[]): void {
	if (documentCache.size >= CACHE_CONFIG.MAX_DOCUMENT_CACHE_SIZE) {
		const oldestKey = documentCache.keys().next().value;
		if (oldestKey) {
			documentCache.delete(oldestKey);
		}
	}

	documentCache.set(getCacheKey(document), {
		brackets,
		version: document.version,
		timestamp: Date.now(),
		size: document.getText().length,
	});
}

export function clearDocumentCache(document: vscode.TextDocument): void {
	const uri = document.uri.toString();
	for (const key of documentCache.keys()) {
		if (key.startsWith(uri + '|')) {
			documentCache.delete(key);
		}
	}
}

export function clearAllCache(): void {
	documentCache.clear();
}

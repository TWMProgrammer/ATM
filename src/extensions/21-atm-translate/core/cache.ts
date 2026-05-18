import { type TranslationProviderId, type TranslationResult } from './types';

const MAX_CACHE_ENTRIES = 250;
const translationCache = new Map<string, CachedResult>();

interface CachedResult {
	text: string;
	providerId: TranslationProviderId;
	providerName: string;
}

export function buildCacheKey(action: 'translate' | 'spellcheck', text: string, from: string, to: string): string {
	return `${action}\u0000${from || 'auto'}\u0000${to}\u0000${text}`;
}

export function getCachedResult(key: string): TranslationResult | undefined {
	const cached = translationCache.get(key);
	if (!cached) { return undefined; }

	return {
		...cached,
		fromCache: true,
	};
}

export function setCachedResult(key: string, value: TranslationResult): void {
	if (value.providerId === 'cache' || value.providerId === 'localSpellcheck') { return; }
	if (translationCache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = translationCache.keys().next().value;
		if (oldestKey !== undefined) { translationCache.delete(oldestKey); }
	}

	translationCache.set(key, {
		text: value.text,
		providerId: value.providerId,
		providerName: value.providerName,
	});
}


export const quickUrls = {
	translate: 'https://translate.google.com/?igu=1',
	mdn: 'https://developer.mozilla.org/en-US/',
	chatgpt: 'https://chatgpt.com/',
} as const;

const searchUrl = 'https://duckduckgo.com/';

export function resolveNavigationTarget(value: string): string {
	const query = value.trim();
	if (!query) { return ''; }

	if (looksLikeUrl(query)) {
		return normalizeUrl(query);
	}

	return `${searchUrl}?q=${encodeURIComponent(query)}`;
}

function looksLikeUrl(value: string): boolean {
	if (/^https?:\/\//i.test(value)) { return true; }
	// Has a dot, no spaces, and at least a 2-char extension
	return /^[^\s]+\.[a-z]{2,}([\/\?#].*)?$/i.test(value);
}

function normalizeUrl(value: string): string {
	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	return `https://${value}`;
}

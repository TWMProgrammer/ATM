export const quickUrls = {
	translate: 'https://translate.yandex.com/en/',
} as const;

export function resolveNavigationTarget(value: string): string {
	const query = value.trim();
	if (!query) { return ''; }

	if (looksLikeUrl(query)) {
		return normalizeUrl(query);
	}

	return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function looksLikeUrl(value: string): boolean {
	return value.includes('.') && !value.includes(' ');
}

function normalizeUrl(value: string): string {
	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	return `https://${value}`;
}

export const quickUrls = {
	translate: 'https://translate.yandex.com/en/',
} as const;

const googleSearchUrl = 'https://www.google.com/search';

export function resolveNavigationTarget(value: string): string {
	const query = value.trim();
	if (!query) { return ''; }

	if (looksLikeUrl(query)) {
		return normalizeUrl(query);
	}

	const params = new URLSearchParams({
		igu: '1',
		q: query,
	});

	return `${googleSearchUrl}?${params.toString()}`;
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

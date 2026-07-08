import { escapeRegExp } from './text';

const regexCache = new Map<string, RegExp>();
const MAX_REGEX_CACHE_SIZE = 50;

export function getCachedRegex(pattern: string, flags = 'g'): RegExp {
	const key = `${pattern}|${flags}`;
	const cached = regexCache.get(key);
	if (cached) {
		return cached;
	}

	if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
		const firstKey = regexCache.keys().next().value;
		if (firstKey) {
			regexCache.delete(firstKey);
		}
	}

	try {
		const regex = new RegExp(pattern, flags);
		regexCache.set(key, regex);
		return regex;
	} catch {
		return /./g;
	}
}

export function makeRegExpPart(text: string): string {
	return escapeRegExp(text).replace(/\s+/, '\\s');
}

export function regExpExecToArray(regexp: RegExp, text: string): RegExpExecArray[] {
	const result: RegExpExecArray[] = [];
	let match: RegExpExecArray | null;

	while ((match = regexp.exec(text)) !== null) {
		result.push(match);
		if (match.index === regexp.lastIndex) {
			regexp.lastIndex++;
		}
	}

	return result;
}

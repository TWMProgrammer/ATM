import {
	correctionDictionaries,
	isSupportedCorrectionLanguage,
	type CorrectionDictionary,
	type SupportedCorrectionLanguage,
} from './data';

export interface LocalSpellcheckResult {
	text: string;
	changed: boolean;
	corrections: number;
}

type SpellLanguage = SupportedCorrectionLanguage | 'auto';

const protectedPattern =
	/```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s"'`<>]+|[\w.-]+@[\w.-]+\.\w{2,}|(?:\.{1,2}\/|~\/|\/)[^\s"'`<>]+|#[0-9a-fA-F]{3,8}\b/g;

const wordPattern = /[\p{L}]+(?:['’][\p{L}]+)?/gu;

export function correctTextLocally(text: string, language: string): LocalSpellcheckResult {
	const normalizedLanguage = normalizeLanguage(language);
	const dictionaries = getCorrectionDictionaries(text, normalizedLanguage);
	let corrections = 0;

	const correctedText = replaceOutsideProtectedRanges(text, (segment) =>
		segment.replace(wordPattern, (word) => {
			const correction = findCorrection(word, dictionaries);
			if (!correction || correction === word) {
				return word;
			}

			corrections++;
			return correction;
		})
	);

	return {
		text: correctedText,
		changed: correctedText !== text,
		corrections,
	};
}

function normalizeLanguage(language: string): SpellLanguage {
	const lower = language.toLowerCase();
	if (lower === 'zh-cn' || lower === 'zh') { return 'zh-CN'; }

	const baseLanguage = lower.split('-')[0];
	if (isSupportedCorrectionLanguage(baseLanguage)) {
		return baseLanguage;
	}

	return 'auto';
}

function getCorrectionDictionaries(
	text: string,
	language: SpellLanguage,
): CorrectionDictionary[] {
	if (language !== 'auto') {
		return withFallbackDictionaries(language);
	}

	return looksSpanish(text)
		? [correctionDictionaries.es, correctionDictionaries.en]
		: [correctionDictionaries.en, correctionDictionaries.es];
}

function withFallbackDictionaries(language: SupportedCorrectionLanguage): CorrectionDictionary[] {
	const primary = correctionDictionaries[language];
	const fallbacks = [correctionDictionaries.es, correctionDictionaries.en]
		.filter((dictionary) => dictionary !== primary);

	return [primary, ...fallbacks];
}

function looksSpanish(text: string): boolean {
	if (/[ñáéíóúü¿¡]/i.test(text)) { return true; }

	const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
	const spanishMarkers = new Set([
		'el',
		'la',
		'los',
		'las',
		'que',
		'para',
		'con',
		'por',
		'una',
		'uno',
		'estoy',
		'quiero',
		'cuando',
		'usuario',
		'traducir',
		'ingles',
		'espanol',
	]);

	return words.some((word) => spanishMarkers.has(word));
}

function findCorrection(
	word: string,
	dictionaries: CorrectionDictionary[],
): string | undefined {
	const normalizedWord = normalizeWord(word);

	for (const dictionary of dictionaries) {
		const correction = dictionary[normalizedWord];
		if (correction) {
			return applyOriginalCasing(word, correction);
		}
	}

	return undefined;
}

function normalizeWord(word: string): string {
	return word.toLowerCase().replace(/[’]/g, "'");
}

function applyOriginalCasing(original: string, correction: string): string {
	if (original.toUpperCase() === original) {
		return correction.toUpperCase();
	}

	if (isCapitalized(original)) {
		return correction.charAt(0).toUpperCase() + correction.slice(1);
	}

	return correction;
}

function isCapitalized(value: string): boolean {
	const first = value.charAt(0);
	return first.toUpperCase() === first && first.toLowerCase() !== first;
}

function replaceOutsideProtectedRanges(
	text: string,
	replaceSegment: (segment: string) => string,
): string {
	let result = '';
	let lastIndex = 0;

	for (const match of text.matchAll(protectedPattern)) {
		const index = match.index ?? 0;
		result += replaceSegment(text.slice(lastIndex, index));
		result += match[0];
		lastIndex = index + match[0].length;
	}

	result += replaceSegment(text.slice(lastIndex));
	return result;
}

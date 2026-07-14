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

	const correctedText = replaceOutsideProtectedRanges(text, (segment) => {
		let correctedSegment = segment;

		for (const dictionary of dictionaries) {
			for (const [mistake, correction] of Object.entries(dictionary)) {
				if (!mistake.includes(' ')) { continue; }

				correctedSegment = correctedSegment.replace(
					new RegExp(`\\b${escapeRegExp(mistake)}\\b`, 'giu'),
					(match) => {
						corrections++;
						return applyOriginalCasing(match, correction);
					},
				);
			}
		}

		return correctedSegment.replace(wordPattern, (word) => {
			const correction = findCorrection(word, dictionaries);
			if (!correction || correction === word) {
				return word;
			}

			corrections++;
			return correction;
		});
	});

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

	return withFallbackDictionaries(detectLikelyLanguage(text));
}

function withFallbackDictionaries(language: SupportedCorrectionLanguage): CorrectionDictionary[] {
	const primary = correctionDictionaries[language];
	const commonFallbacks = [
		correctionDictionaries.es,
		correctionDictionaries.en,
		correctionDictionaries.pt,
		correctionDictionaries.fr,
	].filter((dictionary) => dictionary !== primary);

	return [primary, ...commonFallbacks];
}

function detectLikelyLanguage(text: string): SupportedCorrectionLanguage {
	if (/[\u3040-\u30ff]/.test(text)) { return 'ja'; }
	if (/[\u4e00-\u9fff]/.test(text)) { return 'zh-CN'; }
	if (/[\uac00-\ud7af]/.test(text)) { return 'ko'; }
	if (/[\u0900-\u097f]/.test(text)) { return 'hi'; }
	if (/[\u0600-\u06ff]/.test(text)) { return 'ar'; }
	if (/[\u0400-\u04ff]/.test(text)) { return 'ru'; }
	if (/[ăâêôơưđ]/i.test(text)) { return 'vi'; }
	if (/[ñ¿¡]/i.test(text)) { return 'es'; }

	const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
	const languageScores: Record<SupportedCorrectionLanguage, number> = {
		en: scoreLanguage(words, ['the', 'and', 'you', 'that', 'this', 'with', 'for', 'hello', 'from', 'translate']),
		es: scoreLanguage(words, ['el', 'la', 'los', 'las', 'que', 'para', 'con', 'por', 'una', 'estoy', 'quiero', 'cuando', 'usuario', 'traducir', 'ingles', 'espanol']),
		fr: scoreLanguage(words, ['le', 'la', 'les', 'des', 'que', 'pour', 'avec', 'bonjour', 'merci', 'etre', 'francais', 'tres']),
		de: scoreLanguage(words, ['der', 'die', 'das', 'und', 'ich', 'nicht', 'hallo', 'danke', 'deutsch', 'fur', 'uber']),
		it: scoreLanguage(words, ['il', 'lo', 'la', 'gli', 'che', 'per', 'con', 'ciao', 'grazie', 'perche', 'piu']),
		pt: scoreLanguage(words, ['o', 'a', 'os', 'as', 'que', 'para', 'com', 'voce', 'nao', 'obrigado', 'traducao']),
		vi: scoreLanguage(words, ['toi', 'ban', 'khong', 'cam', 'on', 'chao', 'duoc', 'tieng', 'viet']),
		ja: 0,
		ko: 0,
		'zh-CN': 0,
		hi: 0,
		ar: 0,
		ru: 0,
	};
	const [bestLanguage, bestScore] = Object.entries(languageScores)
		.sort((a, b) => b[1] - a[1])[0] as [SupportedCorrectionLanguage, number];

	return bestScore > 0 ? bestLanguage : 'en';
}

function scoreLanguage(words: string[], markers: string[]): number {
	const markerSet = new Set(markers);
	return words.reduce((score, word) => score + (markerSet.has(word) ? 1 : 0), 0);
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
	if (!usesCase(original)) {
		return correction;
	}

	if (original.toUpperCase() === original) {
		return correction.toUpperCase();
	}

	if (isCapitalized(original)) {
		return correction.charAt(0).toUpperCase() + correction.slice(1);
	}

	return correction;
}

function usesCase(value: string): boolean {
	return /[a-z]/i.test(value);
}

function isCapitalized(value: string): boolean {
	const first = value.charAt(0);
	return first.toUpperCase() === first && first.toLowerCase() !== first;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

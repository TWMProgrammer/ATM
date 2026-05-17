import { emptyCorrections } from './empty';
import { enCorrections } from './en';
import { esCorrections } from './es';
import type { CorrectionDictionary } from './types';

export type SupportedCorrectionLanguage =
	| 'en'
	| 'es'
	| 'fr'
	| 'de'
	| 'it'
	| 'pt'
	| 'ja'
	| 'ko'
	| 'zh-CN'
	| 'hi'
	| 'ar'
	| 'ru'
	| 'vi';

export const correctionDictionaries: Record<SupportedCorrectionLanguage, CorrectionDictionary> = {
	en: enCorrections,
	es: esCorrections,
	fr: emptyCorrections,
	de: emptyCorrections,
	it: emptyCorrections,
	pt: emptyCorrections,
	ja: emptyCorrections,
	ko: emptyCorrections,
	'zh-CN': emptyCorrections,
	hi: emptyCorrections,
	ar: emptyCorrections,
	ru: emptyCorrections,
	vi: emptyCorrections,
};

export function isSupportedCorrectionLanguage(
	language: string,
): language is SupportedCorrectionLanguage {
	return Object.prototype.hasOwnProperty.call(correctionDictionaries, language);
}

export type { CorrectionDictionary };

import { arCorrections } from './ar';
import { deCorrections } from './de';
import { enCorrections } from './en';
import { esCorrections } from './es';
import { frCorrections } from './fr';
import { hiCorrections } from './hi';
import { itCorrections } from './it';
import { jaCorrections } from './ja';
import { koCorrections } from './ko';
import { ptCorrections } from './pt';
import { ruCorrections } from './ru';
import type { CorrectionDictionary } from './types';
import { viCorrections } from './vi';
import { zhCnCorrections } from './zh-cn';

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
	fr: frCorrections,
	de: deCorrections,
	it: itCorrections,
	pt: ptCorrections,
	ja: jaCorrections,
	ko: koCorrections,
	'zh-CN': zhCnCorrections,
	hi: hiCorrections,
	ar: arCorrections,
	ru: ruCorrections,
	vi: viCorrections,
};

export function isSupportedCorrectionLanguage(
	language: string,
): language is SupportedCorrectionLanguage {
	return Object.prototype.hasOwnProperty.call(correctionDictionaries, language);
}

export type { CorrectionDictionary };

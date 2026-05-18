export interface LanguageEntry {
	code: string;
	name: string;
	flag: string;
}

export const languages: LanguageEntry[] = [
	{ code: 'auto', name: 'Auto detect', flag: '🌐' },
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'es', name: 'Spanish', flag: '🇪🇸' },
	{ code: 'fr', name: 'French', flag: '🇫🇷' },
	{ code: 'de', name: 'German', flag: '🇩🇪' },
	{ code: 'it', name: 'Italian', flag: '🇮🇹' },
	{ code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
	{ code: 'ja', name: 'Japanese', flag: '🇯🇵' },
	{ code: 'ko', name: 'Korean', flag: '🇰🇷' },
	{ code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
	{ code: 'hi', name: 'Hindi', flag: '🇮🇳' },
	{ code: 'ar', name: 'Arabic', flag: '🇸🇦' },
	{ code: 'ru', name: 'Russian', flag: '🇷🇺' },
	{ code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
];

export const languageCodes = new Set(languages.map((language) => language.code));

export function getLanguageName(code: string): string {
	return languages.find((language) => language.code === code)?.name ?? code;
}

export function getLanguageFlag(code: string): string {
	return languages.find((language) => language.code === code)?.flag ?? '';
}

export function isValidSourceLanguage(code: string): boolean {
	return languageCodes.has(code);
}

export function isValidTargetLanguage(code: string): boolean {
	return code !== 'auto' && languageCodes.has(code);
}


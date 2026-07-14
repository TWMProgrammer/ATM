import type { LanguageDescriptor } from '../types';

export const jsonDescriptor: LanguageDescriptor = {
	id: 'json',
	vscodeLanguageIds: ['json'],
	extensions: ['.json'],
	parsers: ['json'],
	enabled: true,
	rangeFormatting: false,
};

import type { LanguageDescriptor } from '../types';

/**
 * TypeScript + TSX language descriptor.
 *
 * Covers: `.ts`, `.tsx`, `.cts`, `.mts`
 * VS Code language IDs: `typescript`, `typescriptreact`
 * Prettier parser: `typescript`
 */
export const typescriptDescriptor: LanguageDescriptor = {
	id: 'typescript',
	vscodeLanguageIds: ['typescript', 'typescriptreact'],
	extensions: ['.ts', '.tsx', '.cts', '.mts'],
	parsers: ['typescript'],
	enabled: true,
	rangeFormatting: true,
};

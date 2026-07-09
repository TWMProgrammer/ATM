import type { LanguageDescriptor } from '../types';

/**
 * CSS language descriptor.
 *
 * Covers: `.css`, `.wxss`
 * VS Code language ID: `css`
 * Prettier parser: `css`
 *
 * Note: Less (`.less`) and SCSS (`.scss`) are handled by the same
 * `postcss` Prettier plugin package and can be enabled in the future
 * by adding descriptors with `parser: 'less'` / `parser: 'scss'`
 * — no new plugin import needed.
 */
export const cssDescriptor: LanguageDescriptor = {
	id: 'css',
	vscodeLanguageIds: ['css'],
	extensions: ['.css', '.wxss'],
	parsers: ['css'],
	enabled: true,
	rangeFormatting: false,
};

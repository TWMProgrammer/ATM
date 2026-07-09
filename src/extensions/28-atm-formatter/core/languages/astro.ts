import type { LanguageDescriptor } from '../types';

/**
 * Astro language descriptor.
 *
 * Covers: `.astro`
 * VS Code language ID: `astro`
 * Prettier parser: `astro`
 *
 * The parser is provided by `prettier-plugin-astro`, which in turn uses
 * `@astrojs/compiler` (a WASM-based parser).  The WASM (~5 MB) is
 * externalized in the esbuild config and loaded lazily from `node_modules`
 * only when an `.astro` file is actually formatted — keeping extension
 * activation fast.
 *
 * The plugin also requires `prettier/plugins/babel` for formatting embedded
 * JS expressions and `<script>` tags inside `.astro` files.
 */
export const astroDescriptor: LanguageDescriptor = {
	id: 'astro',
	vscodeLanguageIds: ['astro'],
	extensions: ['.astro'],
	parsers: ['astro'],
	enabled: true,
	rangeFormatting: false,
};

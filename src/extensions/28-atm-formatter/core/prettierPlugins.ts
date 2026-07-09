/**
 * Central registry of all bundled Prettier plugin packages.
 *
 * We use `prettier/standalone` (93 kb core) and import only the parser
 * packages we need.  This keeps the bundle at ~1.9 mb instead of the
 * 3.5 mb full Prettier build that includes every parser.
 *
 * The Astro plugin's WASM parser (`@astrojs/compiler`, ~5 MB) is
 * externalized in esbuild and loaded lazily from `node_modules` only
 * when an `.astro` file is actually formatted.
 *
 * ════════════════════════════════════════════════════════════════════
 *  TO ADD A NEW TECHNOLOGY THAT NEEDS A NEW PARSER PACKAGE
 * ════════════════════════════════════════════════════════════════════
 *  1. `bun add prettier-plugin-xxx`
 *  2. Add an `import * as xxx from 'prettier-plugin-xxx'` below.
 *  3. Add `xxx` to the `bundledPlugins` array.
 *  4. Create a `LanguageDescriptor` in `core/languages/`.
 *  5. If the plugin has native/WASM deps, externalize them in `esbuild.js`.
 *
 *  If the technology reuses an already-imported parser package (e.g. Less
 *  and SCSS reuse the `postcss` plugin), skip steps 1–3 — just add the
 *  descriptor.
 * ════════════════════════════════════════════════════════════════════
 */

import type { Options } from 'prettier';

// Prettier 3.x built-in parser packages — bundled by esbuild.
import * as typescriptPlugin from 'prettier/plugins/typescript';
import * as estreePlugin from 'prettier/plugins/estree';
import * as postcssPlugin from 'prettier/plugins/postcss';
import * as babelPlugin from 'prettier/plugins/babel';

type PrettierPlugins = NonNullable<Options['plugins']>;

// ── Future plugin packages ────────────────────────────────────────────
// import * as lynxPlugin from 'prettier-plugin-lynx';

// Statically bundled plugins. babel is required by prettier-plugin-astro
// for embedded JS/<script> in .astro files.
const staticPlugins: PrettierPlugins = [
	typescriptPlugin,
	estreePlugin,
	postcssPlugin,
	babelPlugin,
	// lynxPlugin,
];

let allPlugins: PrettierPlugins | null = null;

/**
 * All Prettier plugins, passed to every `format()` call — Prettier picks by
 * the `parser` option.
 *
 * prettier-plugin-astro is dynamic-imported: its top-level requires of
 * '@astrojs/compiler/sync' + 'sass-formatter' (externalized in esbuild.js,
 * shipped in dist/node_modules) must NOT run at activation — if they're
 * missing only .astro formatting breaks, never the whole extension.
 */
export async function getBundledPlugins(): Promise<PrettierPlugins> {
	if (!allPlugins) {
		try {
			const astroPlugin = await import('prettier-plugin-astro');
			allPlugins = [...staticPlugins, astroPlugin];
		} catch {
			// astro deps unavailable — keep formatter alive for other languages
			allPlugins = staticPlugins;
		}
	}
	return allPlugins;
}

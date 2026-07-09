/**
 * Central registry of all bundled Prettier plugin packages.
 *
 * We use `prettier/standalone` (93 kb core) and import only the parser
 * packages we need.  This keeps the bundle at ~1.3 mb instead of the
 * 3.5 mb full Prettier build that includes every parser.
 *
 * ════════════════════════════════════════════════════════════════════
 *  TO ADD A NEW TECHNOLOGY THAT NEEDS A NEW PARSER PACKAGE
 * ════════════════════════════════════════════════════════════════════
 *  1. `bun add prettier-plugin-xxx`
 *  2. Add an `import * as xxx from 'prettier-plugin-xxx'` below.
 *  3. Add `xxx` to the `bundledPlugins` array.
 *  4. Create a `LanguageDescriptor` in `core/languages/`.
 *
 *  If the technology reuses an already-imported parser package (e.g. Less
 *  and SCSS reuse the `postcss` plugin), skip steps 1–3 — just add the
 *  descriptor.
 * ════════════════════════════════════════════════════════════════════
 */

// Prettier 3.x built-in parser packages — ESM modules that esbuild bundles.
import * as typescriptPlugin from 'prettier/plugins/typescript';
import * as estreePlugin from 'prettier/plugins/estree';
import * as postcssPlugin from 'prettier/plugins/postcss';

// ── Future plugin packages ────────────────────────────────────────────
// import * as astroPlugin from 'prettier-plugin-astro';
// import * as lynxPlugin from 'prettier-plugin-lynx';

/**
 * All bundled Prettier plugins, passed to every `format()` / `getSupportInfo()`
 * call.  Prettier resolves the correct plugin internally based on the
 * `parser` option.
 */
export const bundledPlugins = [
	typescriptPlugin,
	estreePlugin,
	postcssPlugin,
	// astroPlugin,
	// lynxPlugin,
];

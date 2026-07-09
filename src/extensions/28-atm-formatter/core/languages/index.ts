import type { LanguageDescriptor } from '../types';
import { typescriptDescriptor } from './typescript';
import { cssDescriptor } from './css';

/**
 * Master list of all language descriptors.
 *
 * To add a new technology:
 *  1. Create a descriptor file in this directory (e.g. `astro.ts`).
 *  2. Import and add it to this array.
 *  3. If the technology needs a new Prettier plugin package, add it to
 *     `../prettierPlugins.ts`.
 */
export const languageDescriptors: LanguageDescriptor[] = [
	typescriptDescriptor,
	cssDescriptor,
	// ── Future technologies ──────────────────────────────────
	// astroDescriptor,    // prettier-plugin-astro
	// lynxDescriptor,     // prettier-plugin-lynx (when available)
	// lessDescriptor,     // reuses postcss plugin — no new import needed
	// scssDescriptor,     // reuses postcss plugin — no new import needed
];

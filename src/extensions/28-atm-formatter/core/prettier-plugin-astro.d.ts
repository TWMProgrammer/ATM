/**
 * Type declarations for packages that don't ship their own .d.ts files.
 */

declare module 'prettier-plugin-astro' {
	import type { Parser, Printer, SupportLanguage, SupportOption } from 'prettier';

	// SupportLanguage (not Partial) so the import-namespace satisfies prettier's Plugin
	export const languages: SupportLanguage[];
	export const parsers: Record<string, Parser>;
	export const printers: Record<string, Printer>;
	export const options: Record<string, SupportOption>;
	export const defaultOptions: Record<string, unknown>;
}

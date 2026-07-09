/**
 * Core type contracts for the ATM Formatter extension.
 *
 * The central piece is {@link LanguageDescriptor} — a declarative description
 * of a technology this formatter can handle.  Adding a new technology (Astro,
 * LynxJS, …) is as simple as creating a new descriptor file in
 * `core/languages/` and adding the corresponding Prettier plugin to
 * `core/prettierPlugins.ts`.
 */

/* ── Language registry ─────────────────────────────────────────────── */

/**
 * Declarative description of a single technology the formatter supports.
 *
 * To add a new technology:
 *  1. Create a file in `core/languages/` exporting a `LanguageDescriptor`.
 *  2. Add it to the `languageDescriptors` array in `core/languages/index.ts`.
 *  3. If the technology needs a Prettier plugin package that is not already
 *     imported, add it to `core/prettierPlugins.ts`.
 */
export interface LanguageDescriptor {
	/** Unique identifier, e.g. `'typescript'`, `'css'`, `'astro'`. */
	id: string;
	/** VS Code language IDs this descriptor handles. */
	vscodeLanguageIds: string[];
	/** File extensions (with leading dot) this descriptor handles. */
	extensions: string[];
	/** Prettier parser name(s) to try, in priority order. */
	parsers: string[];
	/** Whether this language is currently enabled. */
	enabled: boolean;
	/** Whether range (selection) formatting is supported. */
	rangeFormatting?: boolean;
}

/* ── Config ────────────────────────────────────────────────────────── */

/**
 * Options that map directly to Prettier formatting options.
 * Only the subset we expose through VS Code settings and config files.
 */
export interface FormatterConfig {
	printWidth?: number;
	tabWidth?: number;
	useTabs?: boolean;
	semi?: boolean;
	singleQuote?: boolean;
	trailingComma?: 'none' | 'es5' | 'all';
	bracketSpacing?: boolean;
	bracketSameLine?: boolean;
	arrowParens?: 'avoid' | 'always';
	endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr';
	htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore';
	singleAttributePerLine?: boolean;
}

/** Result of a config resolution attempt. */
export interface ResolvedConfig {
	/** The merged Prettier options, or `null` when no config was found. */
	config: FormatterConfig | null;
	/** Path to the config file that was resolved, if any. */
	configPath: string | null;
}

/* ── Formatting ────────────────────────────────────────────────────── */

/** Input for a full-document format operation. */
export interface FormatDocumentInput {
	text: string;
	parser: string;
	filepath?: string;
	config?: FormatterConfig;
}

/** Input for a range format operation. */
export interface FormatRangeInput extends FormatDocumentInput {
	rangeStart: number;
	rangeEnd: number;
}

/** Result of a format operation. */
export interface FormatResult {
	formatted: string;
	error?: string;
}

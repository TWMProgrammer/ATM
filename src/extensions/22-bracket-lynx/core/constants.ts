import type { SupportedLanguage, ProblematicLanguage, FrameworkConfig } from './types';

export const CONFIG_SECTION = 'atm.bracketLynx';

export const PERFORMANCE_LIMITS = {
	MAX_FILE_SIZE: 5 * 1024 * 1024,
	MAX_DECORATIONS_PER_FILE: 300,
	MIN_BRACKET_SCOPE_LINES: 4,
	MAX_HEADER_LENGTH: 50,
	DEBOUNCE_DELAY_MS: 150,
	LARGE_FILE_THRESHOLD: 100 * 1024,
} as const;

export const CACHE_CONFIG = {
	MAX_DOCUMENT_CACHE_SIZE: 30,
	DOCUMENT_CACHE_TTL_MS: 5 * 60 * 1000,
} as const;

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
	'astro',
	'css',
	'html',
	'javascript',
	'javascriptreact',
	'json',
	'scss',
	'svelte',
	'typescript',
	'typescriptreact',
	'vue',
];

export const PROBLEMATIC_LANGUAGES: readonly ProblematicLanguage[] = [
	'astro',
	'html',
	'vue',
	'svelte',
	'javascriptreact',
	'typescriptreact',
];

export const PROBLEMATIC_EXTENSIONS: readonly string[] = [
	'.astro',
	'.html',
	'.vue',
	'.svelte',
	'.jsx',
	'.tsx',
];

export const ALLOWED_JSON_FILES: readonly string[] = ['package.json'];

export const DEFAULT_LANGUAGE_CONFIGURATION = {
	ignoreCase: false,
	comments: {
		line: ['//'],
		block: [{ opening: '/*', closing: '*/' }],
	},
	brackets: {
		symbol: [
			{ opening: '{', closing: '}', headerMode: 'smart' as const },
			{ opening: '[', closing: ']', headerMode: 'smart' as const },
			{ opening: '(', closing: ')', headerMode: 'smart' as const },
		],
	},
	terminators: [';', ','],
};

export const LANGUAGE_COMMENTS: Readonly<Record<string, { line?: string[]; block?: { opening: string; closing: string }[] }>> = {
	javascript: { line: ['//'], block: [{ opening: '/*', closing: '*/' }] },
	typescript: { line: ['//'], block: [{ opening: '/*', closing: '*/' }] },
	javascriptreact: { line: ['//'], block: [{ opening: '/*', closing: '*/' }] },
	typescriptreact: { line: ['//'], block: [{ opening: '/*', closing: '*/' }] },
	html: { block: [{ opening: '<!--', closing: '-->' }] },
	css: { block: [{ opening: '/*', closing: '*/' }] },
	scss: { line: ['//'], block: [{ opening: '/*', closing: '*/' }] },
	vue: { line: ['//'], block: [{ opening: '/*', closing: '*/' }, { opening: '<!--', closing: '-->' }] },
	astro: { line: ['//'], block: [{ opening: '/*', closing: '*/' }, { opening: '<!--', closing: '-->' }] },
	svelte: { line: ['//'], block: [{ opening: '/*', closing: '*/' }, { opening: '<!--', closing: '-->' }] },
	json: { line: [], block: [] },
};

export const FRAMEWORK_CONFIGS: Readonly<Record<string, FrameworkConfig>> = {
	astro: {
		name: 'Astro',
		extensions: ['.astro', '.html'],
		languageIds: ['astro', 'html'],
		components: ['Fragment', 'Astro', 'Code', 'Markdown', 'Debug', 'slot', 'Component'],
		htmlElements: ['style', 'script', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'html', 'body'],
		hasScoped: false,
	},
	vue: {
		name: 'Vue',
		extensions: ['.vue'],
		languageIds: ['vue'],
		components: ['template', 'script', 'style', 'component', 'transition', 'transition-group', 'keep-alive', 'slot', 'teleport', 'suspense'],
		htmlElements: ['section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'form', 'table', 'ul', 'ol', 'li', 'p', 'span', 'button'],
		hasScoped: true,
	},
	svelte: {
		name: 'Svelte',
		extensions: ['.svelte'],
		languageIds: ['svelte'],
		components: ['script', 'style', 'main', 'section', 'header', 'footer', 'aside', 'nav', 'slot', 'svelte:head', 'svelte:body', 'svelte:window', 'svelte:options', 'svelte:fragment'],
		htmlElements: ['div', 'span', 'section', 'article', 'main', 'ul', 'li', 'button', 'form', 'table', 'p'],
		hasScoped: false,
	},
};

export const FUNCTION_SYMBOLS = {
	NORMAL_ARROW: '=>',
	COLLECTION_ARROW: '->',
	ASYNC_FUNCTION: 'async',
	COMPLEX_FUNCTION: 'fn',
} as const;

export const EXCLUDED_SYMBOLS = [
	'!', '"', '$', '%', '&', "'", ',', '.', '/', ';', '<', '?', '@', '\\',
	'[', ']', '^', '_', '`', '{', '|', '}', '//', '---', '--', '...',
	':', '(', ')', '=', '>', 'MARK',
] as const;

import type { FormatterConfig } from './types';

/**
 * VS Code configuration keys exposed by this extension (under `atm.formatter.*`).
 * Listed here as a typed map for use by the host layer and options mapper.
 */
export const formatterSettingKeys = {
	enable: 'atm.formatter.enable',
	printWidth: 'atm.formatter.printWidth',
	tabWidth: 'atm.formatter.tabWidth',
	useTabs: 'atm.formatter.useTabs',
	semi: 'atm.formatter.semi',
	singleQuote: 'atm.formatter.singleQuote',
	trailingComma: 'atm.formatter.trailingComma',
	bracketSpacing: 'atm.formatter.bracketSpacing',
	bracketSameLine: 'atm.formatter.bracketSameLine',
	arrowParens: 'atm.formatter.arrowParens',
	endOfLine: 'atm.formatter.endOfLine',
	requireConfig: 'atm.formatter.requireConfig',
	ignorePath: 'atm.formatter.ignorePath',
} as const;

/**
 * Reads `atm.formatter.*` VS Code settings and converts them into a
 * `FormatterConfig` object suitable for passing to Prettier.
 *
 * Only keys that are explicitly set (not undefined) are included so that
 * a project-local `.prettierrc` can take precedence for unspecified options.
 */
export function configFromVsCodeSettings(get: (key: string) => unknown): FormatterConfig {
	const config: FormatterConfig = {};

	const printWidth = get(formatterSettingKeys.printWidth);
	if (typeof printWidth === 'number') { config.printWidth = printWidth; }

	const tabWidth = get(formatterSettingKeys.tabWidth);
	if (typeof tabWidth === 'number') { config.tabWidth = tabWidth; }

	const useTabs = get(formatterSettingKeys.useTabs);
	if (typeof useTabs === 'boolean') { config.useTabs = useTabs; }

	const semi = get(formatterSettingKeys.semi);
	if (typeof semi === 'boolean') { config.semi = semi; }

	const singleQuote = get(formatterSettingKeys.singleQuote);
	if (typeof singleQuote === 'boolean') { config.singleQuote = singleQuote; }

	const trailingComma = get(formatterSettingKeys.trailingComma);
	if (trailingComma === 'none' || trailingComma === 'es5' || trailingComma === 'all') {
		config.trailingComma = trailingComma;
	}

	const bracketSpacing = get(formatterSettingKeys.bracketSpacing);
	if (typeof bracketSpacing === 'boolean') { config.bracketSpacing = bracketSpacing; }

	const bracketSameLine = get(formatterSettingKeys.bracketSameLine);
	if (typeof bracketSameLine === 'boolean') { config.bracketSameLine = bracketSameLine; }

	const arrowParens = get(formatterSettingKeys.arrowParens);
	if (arrowParens === 'avoid' || arrowParens === 'always') {
		config.arrowParens = arrowParens;
	}

	const endOfLine = get(formatterSettingKeys.endOfLine);
	if (endOfLine === 'auto' || endOfLine === 'lf' || endOfLine === 'crlf' || endOfLine === 'cr') {
		config.endOfLine = endOfLine;
	}

	return config;
}

/**
 * Merges a Prettier config file (highest priority) with VS Code settings
 * (fallback).  Options present in the config file take precedence; only
 * options *missing* from the config file fall back to VS Code settings.
 */
export function mergeConfig(prettierConfig: FormatterConfig | null, vsCodeConfig: FormatterConfig): FormatterConfig {
	if (!prettierConfig) {
		return vsCodeConfig;
	}
	return { ...vsCodeConfig, ...prettierConfig };
}

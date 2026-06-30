import * as vscode from 'vscode';
import {
	CONFIG_SECTION,
	PERFORMANCE_LIMITS,
	DEFAULT_LANGUAGE_CONFIGURATION,
	LANGUAGE_COMMENTS,
	DEFAULT_COLOR,
	DEFAULT_PREFIX,
} from './constants';
import type { LanguageConfiguration } from './types';

export interface BracketLynxConfigValues {
	prefix: string;
	color: string;
	fontStyle: 'normal' | 'italic' | 'bold';
	unmatchBracketsPrefix: string;
	mode: 'auto' | 'manual';
	debug: boolean;
	maxBracketHeaderLength: number;
	minBracketScopeLines: number;
	enablePerformanceFilters: boolean;
	maxFileSize: number;
	maxDecorationsPerFile: number;
	globalEnabled: boolean;
}

export function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function getPrefix(): string {
	return getConfig().get('prefix', DEFAULT_PREFIX);
}

export function getColor(): string {
	return DEFAULT_COLOR;
}

export function getFontStyle(): 'normal' | 'italic' | 'bold' {
	const value = getConfig().get<string>('fontStyle', 'italic');
	if (value === 'normal' || value === 'italic' || value === 'bold') {
		return value;
	}
	return 'italic';
}

export function getUnmatchBracketsPrefix(): string {
	return getConfig().get('unmatchBracketsPrefix', DEFAULT_PREFIX);
}

export function getMode(): 'auto' | 'manual' {
	const value = getConfig().get<string>('mode', 'auto');
	return value === 'manual' ? 'manual' : 'auto';
}

export function isDebugEnabled(): boolean {
	return getConfig().get('debug', false);
}

export function getMaxBracketHeaderLength(): number {
	const value = getConfig().get('maxBracketHeaderLength', PERFORMANCE_LIMITS.MAX_HEADER_LENGTH);
	return Math.max(10, Math.min(200, value));
}

export function getMinBracketScopeLines(): number {
	const value = getConfig().get('minBracketScopeLines', PERFORMANCE_LIMITS.MIN_BRACKET_SCOPE_LINES);
	return Math.max(1, Math.min(50, value));
}

export function isPerformanceFiltersEnabled(): boolean {
	return getConfig().get('enablePerformanceFilters', true);
}

export function getMaxFileSize(): number {
	const value = getConfig().get('maxFileSize', PERFORMANCE_LIMITS.MAX_FILE_SIZE);
	return Math.max(1024 * 1024, Math.min(100 * 1024 * 1024, value));
}

export function getMaxDecorationsPerFile(): number {
	const value = getConfig().get('maxDecorationsPerFile', PERFORMANCE_LIMITS.MAX_DECORATIONS_PER_FILE);
	return Math.max(50, Math.min(2000, value));
}

export function getLanguageConfiguration(): LanguageConfiguration {
	return getConfig().get('languageConfiguration', DEFAULT_LANGUAGE_CONFIGURATION);
}

export function getLanguageSpecificConfig(languageId: string): LanguageConfiguration {
	const baseConfig = getLanguageConfiguration();
	const comments = LANGUAGE_COMMENTS[languageId];
	if (comments) {
		return { ...baseConfig, comments };
	}
	return baseConfig;
}

export function isGlobalEnabled(): boolean {
	return getConfig().get('globalEnabled', true);
}

export function isValidHexColor(color: string): boolean {
	return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color);
}

export function normalizeHexColor(color: string): string {
	if (!isValidHexColor(color)) {
		return '#515151';
	}

	if (color.length === 4) {
		return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
	}

	if (color.length === 9) {
		return color.substring(0, 7);
	}

	return color;
}

export function getAllConfigValues(): BracketLynxConfigValues {
	return {
		prefix: getPrefix(),
		color: getColor(),
		fontStyle: getFontStyle(),
		unmatchBracketsPrefix: getUnmatchBracketsPrefix(),
		mode: getMode(),
		debug: isDebugEnabled(),
		maxBracketHeaderLength: getMaxBracketHeaderLength(),
		minBracketScopeLines: getMinBracketScopeLines(),
		enablePerformanceFilters: isPerformanceFiltersEnabled(),
		maxFileSize: getMaxFileSize(),
		maxDecorationsPerFile: getMaxDecorationsPerFile(),
		globalEnabled: isGlobalEnabled(),
	};
}

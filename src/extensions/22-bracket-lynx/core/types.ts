import type * as vscode from 'vscode';

export type HeaderMode = 'before' | 'smart' | 'inner';

export interface ScopeTerms {
	opening: string;
	closing: string;
}

export interface BracketTrait extends ScopeTerms {
	headerMode?: HeaderMode;
	inters?: string[];
}

export interface StringTrait extends ScopeTerms {
	escape: string[];
}

export interface LanguageConfiguration {
	ignoreCase: boolean;
	comments?: {
		block?: ScopeTerms[];
		line?: string[];
	};
	brackets?: {
		symbol?: BracketTrait[];
		word?: BracketTrait[];
	};
	strings?: {
		inline?: StringTrait[];
		multiline?: StringTrait[];
	};
	terminators?: string[];
	ignoreSymbols?: string[];
}

export interface TokenEntry {
	position: vscode.Position;
	token: string;
}

export interface BracketEntry {
	start: TokenEntry;
	end: TokenEntry;
	headerMode: HeaderMode;
	isUnmatchBrackets: boolean;
	items: BracketEntry[];
}

export interface BracketContext {
	parentEntry: BracketEntry | undefined;
	previousEntry: BracketEntry | undefined;
	entry: BracketEntry;
	nextEntry: BracketEntry | undefined;
}

export interface BracketDecorationSource {
	range: vscode.Range;
	bracketHeader: string;
}

export interface FrameworkConfig {
	name: string;
	extensions: readonly string[];
	languageIds: readonly string[];
	components: readonly string[];
	htmlElements: readonly string[];
	hasScoped: boolean;
}

export interface ComponentRange {
	name: string;
	startLine: number;
	endLine: number;
	range: vscode.Range;
	hasContent: boolean;
	componentType?: 'framework' | 'html' | 'custom';
	isScoped?: boolean;
}

export type SupportedLanguage =
	| 'astro'
	| 'css'
	| 'html'
	| 'javascript'
	| 'javascriptreact'
	| 'json'
	| 'scss'
	| 'svelte'
	| 'typescript'
	| 'typescriptreact'
	| 'vue';

export type ProblematicLanguage =
	| 'astro'
	| 'html'
	| 'vue'
	| 'svelte'
	| 'javascriptreact'
	| 'typescriptreact';

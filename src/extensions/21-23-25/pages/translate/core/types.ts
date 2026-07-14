export type TranslationProviderId =
	| 'googleUnofficial'
	| 'myMemory'
	| 'libreTranslate'
	| 'deepL'
	| 'googleCloud';

export type ProviderSelection = TranslationProviderId | 'auto';
export type SpellcheckProviderSelection = 'auto' | 'googleUnofficial';

export interface SecretReader {
	get(key: string): Thenable<string | undefined>;
}

export interface TranslationRequest {
	text: string;
	from: string;
	to: string;
	signal?: AbortSignal;
}

export interface SpellcheckRequest {
	text: string;
	language: string;
	signal?: AbortSignal;
}

export interface TranslationResult {
	text: string;
	providerId: TranslationProviderId | 'cache' | 'localSpellcheck';
	providerName: string;
	fromCache?: boolean;
}

export interface TranslationConfiguration {
	provider: ProviderSelection;
	fallbackProviders: TranslationProviderId[];
	spellcheckProvider: SpellcheckProviderSelection;
	googleUnofficialEnabled: boolean;
	myMemoryEmail: string;
	libreTranslateUrl: string;
	deepLEndpoint: 'free' | 'pro';
}


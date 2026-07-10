import * as vscode from 'vscode';
import {
	type ProviderSelection,
	type SpellcheckProviderSelection,
	type TranslationConfiguration,
	type TranslationProviderId,
} from './types';

const TRANSLATE_CONFIG_SECTION = 'atm.translate';

export const translationSecretKeys = {
	deepLApiKey: 'atm.translate.deepLApiKey',
	googleCloudApiKey: 'atm.translate.googleCloudApiKey',
	libreTranslateApiKey: 'atm.translate.libreTranslateApiKey',
} as const;

export const providerNames: Record<TranslationProviderId, string> = {
	googleUnofficial: 'Google Translate',
	myMemory: 'MyMemory',
	libreTranslate: 'LibreTranslate',
	deepL: 'DeepL',
	googleCloud: 'Google Cloud Translation',
};

export const defaultProviderOrder: TranslationProviderId[] = [
	'googleUnofficial',
	'myMemory',
	'libreTranslate',
	'deepL',
	'googleCloud',
];

const providerIds = new Set<TranslationProviderId>(defaultProviderOrder);

export function readConfiguration(): TranslationConfiguration {
	const config = vscode.workspace.getConfiguration(TRANSLATE_CONFIG_SECTION);

	return {
		provider: normalizeProviderSelection(config.get<string>('provider', 'auto')),
		fallbackProviders: normalizeProviderList(config.get<string[]>('fallbackProviders', defaultProviderOrder)),
		spellcheckProvider: normalizeSpellcheckProviderSelection(config.get<string>('spellcheckProvider', 'auto')),
		googleUnofficialEnabled: config.get<boolean>('googleUnofficialEnabled', true),
		myMemoryEmail: config.get<string>('myMemoryEmail', '').trim(),
		libreTranslateUrl: config.get<string>('libreTranslateUrl', 'http://127.0.0.1:5000'),
		deepLEndpoint: config.get<string>('deepLEndpoint', 'free') === 'pro' ? 'pro' : 'free',
	};
}

export function getTranslationProviderOrder(config: TranslationConfiguration): TranslationProviderId[] {
	if (config.provider === 'auto') {
		return config.fallbackProviders;
	}

	return uniqueProviders([config.provider, ...config.fallbackProviders]);
}

export function getSpellcheckProviderOrder(config: TranslationConfiguration): TranslationProviderId[] {
	if (config.spellcheckProvider === 'googleUnofficial') {
		return ['googleUnofficial'];
	}

	const translationOrder = getTranslationProviderOrder(config);
	return uniqueProviders([
		...translationOrder.filter((providerId) => providerId === 'googleUnofficial'),
		'googleUnofficial',
	]);
}

function normalizeProviderSelection(value: string): ProviderSelection {
	return value === 'auto' || providerIds.has(value as TranslationProviderId)
		? value as ProviderSelection
		: 'auto';
}

function normalizeSpellcheckProviderSelection(value: string): SpellcheckProviderSelection {
	return value === 'googleUnofficial' ? value : 'auto';
}

function normalizeProviderList(value: string[]): TranslationProviderId[] {
	const normalized = value.filter((providerId): providerId is TranslationProviderId =>
		providerIds.has(providerId as TranslationProviderId)
	);

	return normalized.length ? uniqueProviders(normalized) : defaultProviderOrder;
}

function uniqueProviders(providerList: TranslationProviderId[]): TranslationProviderId[] {
	return Array.from(new Set(providerList));
}


import * as vscode from 'vscode';
import { translate } from '@vitalets/google-translate-api';
import { correctTextLocally } from './spellcheck/localSpellcheck';

const MAX_TEXT_LENGTH = 5000;
const MAX_CACHE_ENTRIES = 250;
const MIN_GOOGLE_REQUEST_INTERVAL_MS = 900;
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
const DEFAULT_LOCAL_TIMEOUT_MS = 2500;
const DEFAULT_REMOTE_TIMEOUT_MS = 12000;
const TRANSLATE_CONFIG_SECTION = 'atm.translate';

const translationCache = new Map<string, CachedResult>();
const providerCooldownUntil = new Map<TranslationProviderId, number>();

let googleRequestQueue = Promise.resolve();
let lastGoogleRequestStartedAt = 0;

export const translationSecretKeys = {
	deepLApiKey: 'atm.translate.deepLApiKey',
	googleCloudApiKey: 'atm.translate.googleCloudApiKey',
	libreTranslateApiKey: 'atm.translate.libreTranslateApiKey',
} as const;

export type TranslationProviderId =
	| 'googleUnofficial'
	| 'myMemory'
	| 'libreTranslate'
	| 'deepL'
	| 'googleCloud';

type ProviderSelection = TranslationProviderId | 'auto';
type SpellcheckProviderSelection = 'auto' | 'googleUnofficial';
type ProviderErrorCode =
	| 'missingSecret'
	| 'rateLimited'
	| 'unavailable'
	| 'unsupported'
	| 'invalidConfiguration'
	| 'failed';

interface SecretReader {
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

interface CachedResult {
	text: string;
	providerId: TranslationProviderId;
	providerName: string;
}

interface TranslationConfiguration {
	provider: ProviderSelection;
	fallbackProviders: TranslationProviderId[];
	spellcheckProvider: SpellcheckProviderSelection;
	googleUnofficialEnabled: boolean;
	myMemoryEmail: string;
	libreTranslateUrl: string;
	deepLEndpoint: 'free' | 'pro';
}

class ProviderError extends Error {
	constructor(
		readonly providerId: TranslationProviderId,
		readonly providerName: string,
		readonly code: ProviderErrorCode,
		message: string,
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

const providerNames: Record<TranslationProviderId, string> = {
	googleUnofficial: 'Google Translate',
	myMemory: 'MyMemory',
	libreTranslate: 'LibreTranslate',
	deepL: 'DeepL',
	googleCloud: 'Google Cloud Translation',
};

const defaultProviderOrder: TranslationProviderId[] = [
	'googleUnofficial',
	'myMemory',
	'libreTranslate',
	'deepL',
	'googleCloud',
];

const providerIds = new Set<TranslationProviderId>(defaultProviderOrder);

export async function translatePlainText(
	request: TranslationRequest,
	secrets: SecretReader,
): Promise<TranslationResult> {
	const cleanText = request.text.trim();
	if (!cleanText) {
		return { text: '', providerId: 'cache', providerName: 'Cache' };
	}
	if (cleanText.length > MAX_TEXT_LENGTH) {
		throw new Error(`Text is too long. Keep translations under ${MAX_TEXT_LENGTH} characters.`);
	}

	const cacheKey = buildCacheKey('translate', cleanText, request.from, request.to);
	const cached = translationCache.get(cacheKey);
	if (cached) {
		return {
			...cached,
			fromCache: true,
		};
	}

	const config = readConfiguration();
	const providerOrder = getTranslationProviderOrder(config);
	const errors: ProviderError[] = [];

	for (const providerId of providerOrder) {
		if (providerId === 'googleUnofficial' && !config.googleUnofficialEnabled) {
			continue;
		}
		if (isProviderCoolingDown(providerId)) {
			errors.push(new ProviderError(
				providerId,
				providerNames[providerId],
				'rateLimited',
				`${providerNames[providerId]} is cooling down after a rate limit.`,
			));
			continue;
		}

		try {
			const result = await translateWithProvider(providerId, cleanText, request, config, secrets);
			setCachedResult(cacheKey, result);
			return result;
		} catch (error) {
			if (request.signal?.aborted) {
				throw new Error('Translation cancelled.');
			}

			const providerError = toProviderError(providerId, error);
			if (providerError.code === 'rateLimited') {
				providerCooldownUntil.set(providerId, Date.now() + RATE_LIMIT_COOLDOWN_MS);
			}
			errors.push(providerError);
		}
	}

	throw buildTranslationFailure(errors);
}

export async function correctPlainText(
	request: SpellcheckRequest,
	secrets: SecretReader,
): Promise<TranslationResult> {
	const cleanText = request.text.trim();
	if (!cleanText) {
		return { text: '', providerId: 'cache', providerName: 'Cache' };
	}
	if (cleanText.length > MAX_TEXT_LENGTH) {
		throw new Error(`Text is too long. Keep spelling checks under ${MAX_TEXT_LENGTH} characters.`);
	}

	const localResult = correctTextLocally(cleanText, request.language);
	if (localResult.changed) {
		return {
			text: localResult.text,
			providerId: 'localSpellcheck',
			providerName: `Local dictionary (${localResult.corrections})`,
		};
	}

	const config = readConfiguration();
	const providerOrder = getSpellcheckProviderOrder(config);
	const cacheKey = buildCacheKey('spellcheck', cleanText, request.language, request.language);
	const cached = translationCache.get(cacheKey);
	if (cached) {
		return {
			...cached,
			fromCache: true,
		};
	}

	const errors: ProviderError[] = [];
	for (const providerId of providerOrder) {
		if (providerId === 'googleUnofficial' && !config.googleUnofficialEnabled) {
			continue;
		}
		if (isProviderCoolingDown(providerId)) {
			continue;
		}

		try {
			const result = await correctWithProvider(providerId, cleanText, request, config, secrets);
			setCachedResult(cacheKey, result);
			return result;
		} catch (error) {
			if (request.signal?.aborted) {
				throw new Error('Spelling correction cancelled.');
			}

			const providerError = toProviderError(providerId, error);
			if (providerError.code === 'rateLimited') {
				providerCooldownUntil.set(providerId, Date.now() + RATE_LIMIT_COOLDOWN_MS);
			}
			errors.push(providerError);
		}
	}

	throw buildSpellcheckFailure(errors);
}

function readConfiguration(): TranslationConfiguration {
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

function getTranslationProviderOrder(config: TranslationConfiguration): TranslationProviderId[] {
	if (config.provider === 'auto') {
		return config.fallbackProviders;
	}

	return uniqueProviders([config.provider, ...config.fallbackProviders]);
}

function getSpellcheckProviderOrder(config: TranslationConfiguration): TranslationProviderId[] {
	if (config.spellcheckProvider === 'googleUnofficial') {
		return ['googleUnofficial'];
	}

	const translationOrder = getTranslationProviderOrder(config);
	return uniqueProviders([
		...translationOrder.filter((providerId) => providerId === 'googleUnofficial'),
		'googleUnofficial',
	]);
}

function uniqueProviders(providerList: TranslationProviderId[]): TranslationProviderId[] {
	return Array.from(new Set(providerList));
}

async function translateWithProvider(
	providerId: TranslationProviderId,
	text: string,
	request: TranslationRequest,
	config: TranslationConfiguration,
	secrets: SecretReader,
): Promise<TranslationResult> {
	switch (providerId) {
		case 'googleUnofficial':
			return translateWithGoogleUnofficial(text, request);
		case 'myMemory':
			return translateWithMyMemory(text, request, config);
		case 'libreTranslate':
			return translateWithLibreTranslate(text, request, config, secrets);
		case 'deepL':
			return translateWithDeepL(text, request, config, secrets);
		case 'googleCloud':
			return translateWithGoogleCloud(text, request, secrets);
	}
}

async function correctWithProvider(
	providerId: TranslationProviderId,
	text: string,
	request: SpellcheckRequest,
	config: TranslationConfiguration,
	_secrets: SecretReader,
): Promise<TranslationResult> {
	switch (providerId) {
		case 'googleUnofficial':
			return correctWithGoogleUnofficial(text, request);
		case 'myMemory':
		case 'libreTranslate':
		case 'deepL':
		case 'googleCloud':
			throw new ProviderError(
				providerId,
				providerNames[providerId],
				'unsupported',
				`${providerNames[providerId]} does not support spelling correction here.`,
			);
	}
}

async function translateWithGoogleUnofficial(
	text: string,
	request: TranslationRequest,
): Promise<TranslationResult> {
	const options: {
		to: string;
		from?: string;
		fetchOptions: { signal?: AbortSignal };
	} = {
		to: request.to,
		fetchOptions: { signal: request.signal },
	};

	if (request.from && request.from !== 'auto') {
		options.from = request.from;
	}

	const resultText = await enqueueGoogleTranslation(async () => {
		throwIfAborted(request.signal);
		await waitForGoogleRateLimit(request.signal);

		try {
			const result = await translate(text, options);
			return result.text;
		} catch (error) {
			throw normalizeProviderFailure('googleUnofficial', error);
		}
	});

	return {
		text: resultText,
		providerId: 'googleUnofficial',
		providerName: providerNames.googleUnofficial,
	};
}

async function correctWithGoogleUnofficial(
	text: string,
	request: SpellcheckRequest,
): Promise<TranslationResult> {
	const lang = request.language === 'auto' ? 'en' : request.language;
	return translateWithGoogleUnofficial(text, {
		text,
		from: lang,
		to: lang,
		signal: request.signal,
	});
}

async function translateWithMyMemory(
	text: string,
	request: TranslationRequest,
	config: TranslationConfiguration,
): Promise<TranslationResult> {
	const sourceLanguage = normalizeMyMemoryLanguage(
		request.from === 'auto' ? guessSourceLanguage(text, request.to) : request.from
	);
	const targetLanguage = normalizeMyMemoryLanguage(request.to);
	if (request.from === 'auto' && sourceLanguage === targetLanguage) {
		return {
			text,
			providerId: 'myMemory',
			providerName: providerNames.myMemory,
		};
	}

	const chunks = splitByUtf8Bytes(text, 450);
	const translatedChunks: string[] = [];

	for (const chunk of chunks) {
		throwIfAborted(request.signal);

		const params = new URLSearchParams({
			q: chunk,
			langpair: `${sourceLanguage}|${targetLanguage}`,
			mt: '1',
		});

		if (config.myMemoryEmail) {
			params.set('de', config.myMemoryEmail);
		}

		const response = await fetchJson<{
			responseData?: { translatedText?: string };
			responseStatus?: number;
			responseDetails?: string;
		}>(
			`https://api.mymemory.translated.net/get?${params.toString()}`,
			{ method: 'GET' },
			DEFAULT_REMOTE_TIMEOUT_MS,
			request.signal,
		);

		if (response.responseStatus && response.responseStatus >= 400) {
			throw new ProviderError(
				'myMemory',
				providerNames.myMemory,
				response.responseStatus === 429 ? 'rateLimited' : 'failed',
				response.responseDetails || 'MyMemory failed.',
			);
		}

		if (typeof response.responseData?.translatedText !== 'string') {
			throw new ProviderError('myMemory', providerNames.myMemory, 'failed', response.responseDetails || 'MyMemory returned an empty response.');
		}

		translatedChunks.push(response.responseData.translatedText);
	}

	return {
		text: translatedChunks.join(''),
		providerId: 'myMemory',
		providerName: providerNames.myMemory,
	};
}

async function translateWithLibreTranslate(
	text: string,
	request: TranslationRequest,
	config: TranslationConfiguration,
	secrets: SecretReader,
): Promise<TranslationResult> {
	const baseUrl = normalizeBaseUrl(config.libreTranslateUrl, 'libreTranslate');
	const apiKey = await secrets.get(translationSecretKeys.libreTranslateApiKey);
	const body = new URLSearchParams({
		q: text,
		source: normalizeLibreTranslateLanguage(request.from),
		target: normalizeLibreTranslateLanguage(request.to),
		format: 'text',
	});

	if (apiKey) {
		body.set('api_key', apiKey);
	}

	const response = await fetchJson<{ translatedText?: string }>(
		`${baseUrl}/translate`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		},
		DEFAULT_LOCAL_TIMEOUT_MS,
		request.signal,
	);

	if (typeof response.translatedText !== 'string') {
		throw new ProviderError('libreTranslate', providerNames.libreTranslate, 'failed', 'LibreTranslate returned an empty response.');
	}

	return {
		text: response.translatedText,
		providerId: 'libreTranslate',
		providerName: providerNames.libreTranslate,
	};
}

async function translateWithDeepL(
	text: string,
	request: TranslationRequest,
	config: TranslationConfiguration,
	secrets: SecretReader,
): Promise<TranslationResult> {
	const apiKey = await secrets.get(translationSecretKeys.deepLApiKey);
	if (!apiKey) {
		throw new ProviderError('deepL', providerNames.deepL, 'missingSecret', 'DeepL API key is not configured.');
	}

	const endpoint = config.deepLEndpoint === 'pro'
		? 'https://api.deepl.com/v2/translate'
		: 'https://api-free.deepl.com/v2/translate';
	const body: {
		text: string[];
		target_lang: string;
		source_lang?: string;
	} = {
		text: [text],
		target_lang: normalizeDeepLTargetLanguage(request.to),
	};

	if (request.from !== 'auto') {
		body.source_lang = normalizeDeepLSourceLanguage(request.from);
	}

	const response = await fetchJson<{ translations?: Array<{ text?: string }> }>(
		endpoint,
		{
			method: 'POST',
			headers: {
				Authorization: `DeepL-Auth-Key ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		},
		DEFAULT_REMOTE_TIMEOUT_MS,
		request.signal,
	);

	const translatedText = response.translations?.[0]?.text;
	if (typeof translatedText !== 'string') {
		throw new ProviderError('deepL', providerNames.deepL, 'failed', 'DeepL returned an empty response.');
	}

	return {
		text: translatedText,
		providerId: 'deepL',
		providerName: providerNames.deepL,
	};
}

async function translateWithGoogleCloud(
	text: string,
	request: TranslationRequest,
	secrets: SecretReader,
): Promise<TranslationResult> {
	const apiKey = await secrets.get(translationSecretKeys.googleCloudApiKey);
	if (!apiKey) {
		throw new ProviderError('googleCloud', providerNames.googleCloud, 'missingSecret', 'Google Cloud Translation API key is not configured.');
	}

	const body: {
		q: string;
		target: string;
		format: 'text';
		source?: string;
	} = {
		q: text,
		target: request.to,
		format: 'text',
	};

	if (request.from !== 'auto') {
		body.source = request.from;
	}

	const response = await fetchJson<{
		data?: {
			translations?: Array<{ translatedText?: string }>;
		};
	}>(
		`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		},
		DEFAULT_REMOTE_TIMEOUT_MS,
		request.signal,
	);

	const translatedText = response.data?.translations?.[0]?.translatedText;
	if (typeof translatedText !== 'string') {
		throw new ProviderError('googleCloud', providerNames.googleCloud, 'failed', 'Google Cloud Translation returned an empty response.');
	}

	return {
		text: decodeHtmlEntities(translatedText),
		providerId: 'googleCloud',
		providerName: providerNames.googleCloud,
	};
}

async function fetchJson<T>(
	url: string,
	init: RequestInit,
	timeoutMs: number,
	parentSignal?: AbortSignal,
): Promise<T> {
	const { signal, dispose } = createTimeoutSignal(timeoutMs, parentSignal);

	try {
		const response = await fetch(url, {
			...init,
			signal,
		});
		const responseText = await response.text();

		if (!response.ok) {
			throw new HttpError(response.status, extractErrorMessage(responseText) || response.statusText);
		}

		return responseText ? JSON.parse(responseText) as T : {} as T;
	} catch (error) {
		if (parentSignal?.aborted) {
			throw new Error('Translation cancelled.');
		}
		throw error;
	} finally {
		dispose();
	}
}

function createTimeoutSignal(
	timeoutMs: number,
	parentSignal?: AbortSignal,
): { signal: AbortSignal; dispose: () => void } {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const onAbort = () => controller.abort();

	if (parentSignal) {
		parentSignal.addEventListener('abort', onAbort, { once: true });
	}

	return {
		signal: controller.signal,
		dispose: () => {
			clearTimeout(timeout);
			parentSignal?.removeEventListener('abort', onAbort);
		},
	};
}

class HttpError extends Error {
	constructor(readonly status: number, message: string) {
		super(message);
		this.name = 'HttpError';
	}
}

function normalizeProviderFailure(providerId: TranslationProviderId, error: unknown): ProviderError {
	const providerName = providerNames[providerId];
	const message = error instanceof Error ? error.message : String(error);

	if (error instanceof ProviderError) {
		return error;
	}
	if (error instanceof HttpError) {
		if (error.status === 401 || error.status === 403) {
			return new ProviderError(providerId, providerName, 'missingSecret', `${providerName} rejected the configured API key.`);
		}
		if (error.status === 429) {
			return new ProviderError(providerId, providerName, 'rateLimited', `${providerName} is rate-limiting requests.`);
		}

		return new ProviderError(providerId, providerName, 'failed', `${providerName} failed: ${error.message}`);
	}
	if (/too many requests|status code 429|\b429\b/i.test(message)) {
		return new ProviderError(providerId, providerName, 'rateLimited', `${providerName} is rate-limiting requests.`);
	}
	if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|network|aborted|timeout/i.test(message)) {
		return new ProviderError(providerId, providerName, 'unavailable', `${providerName} is not reachable.`);
	}

	return new ProviderError(providerId, providerName, 'failed', message || `${providerName} failed.`);
}

function toProviderError(providerId: TranslationProviderId, error: unknown): ProviderError {
	return normalizeProviderFailure(providerId, error);
}

function buildTranslationFailure(errors: ProviderError[]): Error {
	const hasGoogleRateLimit = errors.some((error) => error.providerId === 'googleUnofficial' && error.code === 'rateLimited');
	const hasOnlyUnavailableFallbacks = errors.every((error) =>
		error.code === 'missingSecret'
		|| error.code === 'unavailable'
		|| error.code === 'unsupported'
		|| error.code === 'rateLimited'
	);

	if (hasGoogleRateLimit) {
		return new Error('Google Translate is rate-limiting this IP and public fallback providers are unavailable or exhausted. Run LibreTranslate locally, or configure DeepL/Google Cloud API keys.');
	}
	if (!errors.length || hasOnlyUnavailableFallbacks) {
		return new Error('No translation provider is available. Run LibreTranslate locally, or configure DeepL/Google Cloud API keys.');
	}

	return new Error(errors[errors.length - 1].message);
}

function buildSpellcheckFailure(errors: ProviderError[]): Error {
	if (!errors.length || errors.every((error) => error.code === 'unavailable' || error.code === 'unsupported')) {
		return new Error('No spelling correction provider is available. Enable Google Translate fallback or use local dictionary corrections.');
	}

	return new Error(errors[errors.length - 1].message);
}

function isProviderCoolingDown(providerId: TranslationProviderId): boolean {
	const cooldownUntil = providerCooldownUntil.get(providerId);
	if (!cooldownUntil) { return false; }
	if (Date.now() < cooldownUntil) { return true; }

	providerCooldownUntil.delete(providerId);
	return false;
}

function buildCacheKey(action: 'translate' | 'spellcheck', text: string, from: string, to: string): string {
	return `${action}\u0000${from || 'auto'}\u0000${to}\u0000${text}`;
}

function setCachedResult(key: string, value: TranslationResult): void {
	if (value.providerId === 'cache' || value.providerId === 'localSpellcheck') { return; }
	if (translationCache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = translationCache.keys().next().value;
		if (oldestKey !== undefined) { translationCache.delete(oldestKey); }
	}

	translationCache.set(key, {
		text: value.text,
		providerId: value.providerId,
		providerName: value.providerName,
	});
}

async function enqueueGoogleTranslation<T>(task: () => Promise<T>): Promise<T> {
	const queuedTask = googleRequestQueue.then(task, task);
	googleRequestQueue = queuedTask.then(() => undefined, () => undefined);
	return queuedTask;
}

async function waitForGoogleRateLimit(signal?: AbortSignal): Promise<void> {
	const now = Date.now();
	const waitMs = Math.max(0, lastGoogleRequestStartedAt + MIN_GOOGLE_REQUEST_INTERVAL_MS - now);
	if (waitMs > 0) {
		await delay(waitMs, signal);
	}
	lastGoogleRequestStartedAt = Date.now();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
	if (!signal) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	throwIfAborted(signal);

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error('Translation cancelled.'));
		};

		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error('Translation cancelled.');
	}
}

function normalizeBaseUrl(value: string, providerId: TranslationProviderId): string {
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error('Unsupported protocol.');
		}

		return url.toString().replace(/\/$/, '');
	} catch {
		throw new ProviderError(
			providerId,
			providerNames[providerId],
			'invalidConfiguration',
			`${providerNames[providerId]} URL is invalid.`,
		);
	}
}

function normalizeLibreTranslateLanguage(code: string): string {
	if (code === 'auto') { return 'auto'; }
	if (code === 'zh-CN') { return 'zh'; }
	return code.toLowerCase();
}

function normalizeMyMemoryLanguage(code: string): string {
	if (code === 'zh-CN') { return 'zh-CN'; }
	if (code === 'pt') { return 'pt-BR'; }
	return code;
}

function normalizeDeepLTargetLanguage(code: string): string {
	if (code === 'zh-CN') { return 'ZH'; }
	if (code === 'en') { return 'EN-US'; }
	if (code === 'pt') { return 'PT-BR'; }
	return code.split('-')[0].toUpperCase();
}

function normalizeDeepLSourceLanguage(code: string): string {
	if (code === 'zh-CN') { return 'ZH'; }
	return code.split('-')[0].toUpperCase();
}

function extractErrorMessage(responseText: string): string | undefined {
	if (!responseText) { return undefined; }

	try {
		const parsed = JSON.parse(responseText) as {
			error?: string | { message?: string };
			message?: string;
		};

		if (typeof parsed.error === 'string') { return parsed.error; }
		if (typeof parsed.error?.message === 'string') { return parsed.error.message; }
		if (typeof parsed.message === 'string') { return parsed.message; }
	} catch {
		return responseText.slice(0, 240);
	}

	return undefined;
}

function splitByUtf8Bytes(text: string, maxBytes: number): string[] {
	const chunks: string[] = [];
	let current = '';
	let currentBytes = 0;

	for (const segment of text.match(/\s+|[^\s]+/g) ?? []) {
		const segmentBytes = Buffer.byteLength(segment, 'utf8');

		if (segmentBytes > maxBytes) {
			if (current) {
				chunks.push(current);
				current = '';
				currentBytes = 0;
			}
			chunks.push(...splitLongSegmentByBytes(segment, maxBytes));
			continue;
		}

		if (current && currentBytes + segmentBytes > maxBytes) {
			chunks.push(current);
			current = segment.trimStart();
			currentBytes = Buffer.byteLength(current, 'utf8');
			continue;
		}

		current += segment;
		currentBytes += segmentBytes;
	}

	if (current) {
		chunks.push(current);
	}

	return chunks;
}

function splitLongSegmentByBytes(segment: string, maxBytes: number): string[] {
	const chunks: string[] = [];
	let current = '';
	let currentBytes = 0;

	for (const char of segment) {
		const charBytes = Buffer.byteLength(char, 'utf8');
		if (current && currentBytes + charBytes > maxBytes) {
			chunks.push(current);
			current = '';
			currentBytes = 0;
		}
		current += char;
		currentBytes += charBytes;
	}

	if (current) {
		chunks.push(current);
	}

	return chunks;
}

function guessSourceLanguage(text: string, targetLanguage: string): string {
	if (/[\u3040-\u30ff]/.test(text)) { return 'ja'; }
	if (/[\u4e00-\u9fff]/.test(text)) { return 'zh-CN'; }
	if (/[\uac00-\ud7af]/.test(text)) { return 'ko'; }
	if (/[\u0600-\u06ff]/.test(text)) { return 'ar'; }
	if (/[\u0400-\u04ff]/.test(text)) { return 'ru'; }
	if (/[\u0900-\u097f]/.test(text)) { return 'hi'; }

	const tokens = text.toLowerCase().match(/[a-záéíóúüñçàèìòùâêîôûäöß]+/g) ?? [];
	const scores: Record<string, number> = {
		en: scoreLanguage(tokens, ['the', 'and', 'you', 'that', 'this', 'with', 'for', 'hello', 'from']),
		es: scoreLanguage(tokens, ['el', 'la', 'los', 'las', 'que', 'hola', 'para', 'con', 'por', 'una', 'soy']),
		fr: scoreLanguage(tokens, ['le', 'la', 'les', 'que', 'bonjour', 'pour', 'avec', 'une', 'des', 'est']),
		pt: scoreLanguage(tokens, ['o', 'a', 'os', 'as', 'que', 'olá', 'para', 'com', 'uma', 'sou']),
		it: scoreLanguage(tokens, ['il', 'la', 'gli', 'che', 'ciao', 'per', 'con', 'una', 'sono']),
		de: scoreLanguage(tokens, ['der', 'die', 'das', 'und', 'hallo', 'mit', 'für', 'ich', 'ist']),
	};
	const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

	if (best && best[1] > 0) {
		return best[0];
	}

	return targetLanguage === 'en' ? 'es' : 'en';
}

function scoreLanguage(tokens: string[], markers: string[]): number {
	const markerSet = new Set(markers);
	return tokens.reduce((score, token) => score + (markerSet.has(token) ? 1 : 0), 0);
}

function decodeHtmlEntities(text: string): string {
	const namedEntities: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'",
		'#39': "'",
	};

	return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, name: string) => {
		const normalizedName = name.toLowerCase();
		if (normalizedName.startsWith('#x')) {
			return decodeCodePoint(Number.parseInt(normalizedName.slice(2), 16), entity);
		}
		if (normalizedName.startsWith('#')) {
			return decodeCodePoint(Number.parseInt(normalizedName.slice(1), 10), entity);
		}

		return namedEntities[normalizedName] ?? entity;
	});
}

function decodeCodePoint(value: number, fallback: string): string {
	try {
		return Number.isFinite(value) ? String.fromCodePoint(value) : fallback;
	} catch {
		return fallback;
	}
}

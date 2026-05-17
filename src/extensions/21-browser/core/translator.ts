import { translate } from '@vitalets/google-translate-api';

const MAX_TEXT_LENGTH = 5000;
const MAX_CACHE_ENTRIES = 250;
const MIN_REQUEST_INTERVAL_MS = 900;

const translationCache = new Map<string, string>();

let requestQueue = Promise.resolve();
let lastRequestStartedAt = 0;

export interface TranslationRequest {
	text: string;
	from: string;
	to: string;
	signal?: AbortSignal;
}

export async function translatePlainText({
	text,
	from,
	to,
	signal,
}: TranslationRequest): Promise<string> {
	const cleanText = text.trim();
	if (!cleanText) { return ''; }
	if (cleanText.length > MAX_TEXT_LENGTH) {
		throw new Error(`Text is too long. Keep translations under ${MAX_TEXT_LENGTH} characters.`);
	}

	const key = cacheKey(cleanText, from, to);
	const cached = translationCache.get(key);
	if (cached !== undefined) { return cached; }

	const options: {
		to: string;
		from?: string;
		fetchOptions: { signal?: AbortSignal };
	} = {
		to,
		fetchOptions: { signal },
	};

	if (from && from !== 'auto') {
		options.from = from;
	}

	const resultText = await enqueueTranslation(async () => {
		throwIfAborted(signal);
		await waitForRateLimit(signal);

		try {
			const result = await translate(cleanText, options);
			return result.text;
		} catch (error) {
			throw normalizeTranslationError(error);
		}
	});

	setCachedTranslation(key, resultText);
	return resultText;
}

function cacheKey(text: string, from: string, to: string): string {
	return `${from || 'auto'}\u0000${to}\u0000${text}`;
}

function setCachedTranslation(key: string, value: string): void {
	if (translationCache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = translationCache.keys().next().value;
		if (oldestKey !== undefined) { translationCache.delete(oldestKey); }
	}

	translationCache.set(key, value);
}

async function enqueueTranslation<T>(task: () => Promise<T>): Promise<T> {
	const queuedTask = requestQueue.then(task, task);
	requestQueue = queuedTask.then(() => undefined, () => undefined);
	return queuedTask;
}

async function waitForRateLimit(signal?: AbortSignal): Promise<void> {
	const now = Date.now();
	const waitMs = Math.max(0, lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - now);
	if (waitMs > 0) {
		await delay(waitMs, signal);
	}
	lastRequestStartedAt = Date.now();
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

function normalizeTranslationError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);

	if (/too many requests|status code 429|\b429\b/i.test(message)) {
		return new Error('Google Translate is temporarily rate-limiting this IP. Wait a bit or switch to an official/local provider.');
	}

	return error instanceof Error ? error : new Error('Translation failed.');
}

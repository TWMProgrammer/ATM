import semver from 'semver';

export interface VersionInfo {
	satisfies: string | null;
	latest: string | null;
	error: boolean;
}

interface CacheEntry {
	promise: Promise<RegistryInfo>;
	expiresAt: number;
}

interface RegistryInfo {
	versions: string[];
	latest: string | null;
	error: boolean;
}

interface FetchAttempt {
	info: RegistryInfo;
	retryable: boolean;
}

const memoryCache = new Map<string, CacheEntry>();
const requestQueue: Array<() => void> = [];
const CACHE_TTL = 10 * 60 * 1000;
const ERROR_CACHE_TTL = 30 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_CONCURRENT_REQUESTS = 6;
let activeRequests = 0;

export async function fetchPackageLatestVersion(packageName: string, currentVersionRange: string): Promise<VersionInfo> {
	const registryInfo = await getRegistryInfo(packageName);
	if (registryInfo.error) {
		return { satisfies: null, latest: null, error: true };
	}

	return {
		satisfies: semver.maxSatisfying(registryInfo.versions, currentVersionRange),
		latest: registryInfo.latest,
		error: false
	};
}

async function getRegistryInfo(packageName: string): Promise<RegistryInfo> {
	const now = Date.now();
	const cached = memoryCache.get(packageName);
	if (cached && now < cached.expiresAt) {
		return cached.promise;
	}

	const entry: CacheEntry = {
		promise: fetchRegistryInfo(packageName),
		expiresAt: now + CACHE_TTL
	};

	entry.promise.then(info => {
		if (info.error && memoryCache.get(packageName) === entry) {
			entry.expiresAt = Date.now() + ERROR_CACHE_TTL;
		}
	});

	memoryCache.set(packageName, entry);
	return entry.promise;
}

async function fetchRegistryInfo(packageName: string): Promise<RegistryInfo> {
	return withRequestSlot(async () => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = await fetchRegistryOnce(packageName);
			if (!result.retryable || attempt === 1) {
				return result.info;
			}
		}

		return { versions: [], latest: null, error: true };
	});
}

async function fetchRegistryOnce(packageName: string): Promise<FetchAttempt> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
			headers: { Accept: 'application/vnd.npm.install-v1+json' },
			signal: controller.signal
		});

		if (!response.ok) {
			return {
				info: { versions: [], latest: null, error: true },
				retryable: response.status === 429 || response.status >= 500
			};
		}

		const data = await response.json() as {
			'dist-tags'?: { latest?: unknown };
			versions?: Record<string, unknown>;
		};
		const latest = typeof data['dist-tags']?.latest === 'string' ? data['dist-tags'].latest : null;
		const versions = data.versions ? Object.keys(data.versions) : [];

		return { info: { versions, latest, error: !latest }, retryable: false };
	} catch {
		return { info: { versions: [], latest: null, error: true }, retryable: true };
	} finally {
		clearTimeout(timeoutId);
	}
}

async function withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
	await acquireRequestSlot();
	try {
		return await task();
	} finally {
		releaseRequestSlot();
	}
}

async function acquireRequestSlot(): Promise<void> {
	if (activeRequests < MAX_CONCURRENT_REQUESTS) {
		activeRequests++;
		return;
	}

	await new Promise<void>(resolve => requestQueue.push(resolve));
}

function releaseRequestSlot(): void {
	const next = requestQueue.shift();
	if (next) {
		next();
	} else {
		activeRequests--;
	}
}

export function clearVersionCache(): void {
	memoryCache.clear();
}

import semver from 'semver';

export interface VersionInfo {
    satisfies: string | null;
    latest: string | null;
    error: boolean;
}

interface CacheEntry {
    promise: Promise<VersionInfo>;
    timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
const ERROR_CACHE_TTL = 30 * 1000; // 30 seconds for errors (retry faster)

export async function fetchPackageLatestVersion(packageName: string, currentVersionRange: string): Promise<VersionInfo> {
    const now = Date.now();
    const cached = memoryCache.get(packageName);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.promise;
    }

    const fetchPromise = (async (): Promise<VersionInfo> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        try {
            const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
                headers: { 'Accept': 'application/vnd.npm.install-v1+json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return { satisfies: null, latest: null, error: true };
            }

            const data = await response.json() as any;
            const distTags = data['dist-tags'] || {};
            const latest = distTags.latest;
            
            let satisfies: string | null = null;
            if (data.versions) {
                const allVersions = Object.keys(data.versions);
                satisfies = semver.maxSatisfying(allVersions, currentVersionRange);
            }

            return {
                satisfies: satisfies || null,
                latest: latest || null,
                error: false
            };
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`Error fetching version for ${packageName}:`, error);
            return {
                satisfies: null,
                latest: null,
                error: true
            };
        }
    })();

    /* =========================================================
     * ⏱️ REDUCED TTL FOR ERRORS
     * Errors get a reduced TTL so users can retry quickly
     * ========================================================= */
    fetchPromise.then(result => {
        if (result.error) {
            const entry = memoryCache.get(packageName);
            if (entry) {
                entry.timestamp = now - CACHE_TTL + ERROR_CACHE_TTL;
            }
        }
    });

    memoryCache.set(packageName, { promise: fetchPromise, timestamp: now });
    return fetchPromise;
}

export function clearVersionCache() {
    memoryCache.clear();
}

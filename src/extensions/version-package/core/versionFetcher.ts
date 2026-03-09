import semver from 'semver';

export interface VersionInfo {
    satisfies: string | null;
    latest: string | null;
    error: boolean;
}

const memoryCache = new Map<string, Promise<VersionInfo>>();

export async function fetchPackageLatestVersion(packageName: string, currentVersionRange: string): Promise<VersionInfo> {
    if (memoryCache.has(packageName)) {
        return memoryCache.get(packageName)!;
    }

    const fetchPromise = (async (): Promise<VersionInfo> => {
        try {
            // Abbreviated metadata (much smaller JSON)
            const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
                headers: { 'Accept': 'application/vnd.npm.install-v1+json' }
            });
            
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
            return {
                satisfies: null,
                latest: null,
                error: true
            };
        }
    })();

    memoryCache.set(packageName, fetchPromise);
    return fetchPromise;
}

export function clearVersionCache() {
    memoryCache.clear();
}

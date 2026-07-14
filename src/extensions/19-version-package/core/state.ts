import { VersionInfo } from './versionFetcher';

export interface PackageState {
    name: string;
    currentVersion: string;
    line: number;
    info: VersionInfo;
}

export const packageStateCache = new Map<string, Map<number, PackageState>>();

export function getDocumentCache(uri: string): Map<number, PackageState> {
    if (!packageStateCache.has(uri)) {
        packageStateCache.set(uri, new Map());
    }
    return packageStateCache.get(uri)!;
}

export function clearPackageState(uri?: string) {
    if (uri) {
        packageStateCache.delete(uri);
    } else {
        packageStateCache.clear();
    }
}

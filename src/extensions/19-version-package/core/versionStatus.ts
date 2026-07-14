import semver from 'semver';
import { VersionInfo } from './versionFetcher';

export type VersionStatusKind = 'latest' | 'update' | 'major' | 'breaking' | 'newer' | 'unknown';

export interface VersionStatus {
	kind: VersionStatusKind;
	latest: string | null;
	target: string | null;
	safeTarget: string | null;
}

export function canUpdateVersionString(version: string): boolean {
	return /^(?:\^|~|>=|<=|>|<|=)?v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

export function getVersionStatus(currentRange: string, info: VersionInfo): VersionStatus {
	const range = semver.validRange(currentRange);
	const latest = info.latest ? semver.valid(info.latest) : null;

	if (info.error || !range || !latest) {
		return { kind: 'unknown', latest: info.latest, target: null, safeTarget: null };
	}

	const current = semver.minVersion(range);
	if (!current) {
		return { kind: 'unknown', latest, target: null, safeTarget: null };
	}

	if (semver.satisfies(latest, range)) {
		return { kind: 'latest', latest, target: null, safeTarget: null };
	}

	if (semver.gte(current, latest)) {
		return { kind: 'newer', latest, target: null, safeTarget: null };
	}

	const satisfying = info.satisfies ? semver.valid(info.satisfies) : null;
	const compatibleTarget = satisfying && semver.gt(satisfying, current) ? satisfying : null;
	const isMajor = semver.major(current) !== semver.major(latest);
	const isBreakingZero = current.major === 0 && current.minor !== semver.minor(latest);

	if (isMajor) {
		return { kind: 'major', latest, target: latest, safeTarget: compatibleTarget };
	}

	if (isBreakingZero) {
		return { kind: 'breaking', latest, target: latest, safeTarget: compatibleTarget };
	}

	return { kind: 'update', latest, target: latest, safeTarget: latest };
}

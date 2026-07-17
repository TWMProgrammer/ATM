import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import semver from 'semver';
import { PackageState, isVersionPublished, readPackageInfo } from './detector';
import { createTagName } from './workflow';
import {
    abortMerge,
    addFile,
    branchExists,
    checkout,
    commit,
    createTag,
    getCurrentBranch,
    isWorkingTreeClean,
    merge,
    pull,
    push,
    pushTag,
    tagExists,
} from './git';

export type ReleaseKind = 'major' | 'minor' | 'patch' | 'beta';

export interface ReleaseTarget {
    version: string;
    /** false = package.json already holds the version to release (manual bump) */
    needsBump: boolean;
}

const PUBLISH_POLL_INTERVAL_MS = 15000;
const PUBLISH_TIMEOUT_MS = 8 * 60000;

export interface PublishMonitor {
    onPublishStarted?: (version: string) => void;
    onPublishComplete?: (version: string, published: boolean) => void;
}

/** Only these branches may release; anything else shows a locked button. */
export function isReleaseBranch(branch: string | undefined): boolean {
    return branch === 'dev' || branch === 'main' || branch === 'master';
}

function parseCore(version: string): [number, number, number] | undefined {
    const v = semver.valid(version);
    if (!v) {
        return undefined;
    }
    return [semver.major(v), semver.minor(v), semver.patch(v)];
}

/**
 * Single-digit rollover bump: a slot at exactly 9 carries into the next
 * (0.0.9 -> 0.1.0, 0.9.9 -> 1.0.0) so versions stay single-digit. A slot
 * already past 9 (legacy 0.0.43) just increments (-> 0.0.44).
 */
export function bumpVersion(current: string, kind: 'major' | 'minor' | 'patch'): string | undefined {
    const core = parseCore(current);
    if (!core) {
        return undefined;
    }
    const [major, minor, patch] = core;
    if (kind === 'major') {
        return `${major + 1}.0.0`;
    }
    if (kind === 'minor') {
        return minor === 9 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
    }
    if (patch === 9) {
        return minor === 9 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
}

/**
 * Default target for the rocket button. Priority:
 *  1. package.json is a prerelease (0.0.4-beta.0) -> finalize it (-> 0.0.4).
 *  2. package.json is ahead of what's out there -> release as-is (manual bump).
 *  3. otherwise -> next patch (rollover-aware).
 * `baseline` = npm latest, or the last git tag when npm is unreachable.
 */
export function computeTarget(currentVersion: string, baseline: string | undefined): ReleaseTarget | undefined {
    if (!semver.valid(currentVersion)) {
        return undefined;
    }
    if (semver.prerelease(currentVersion)) {
        const finalized = `${semver.major(currentVersion)}.${semver.minor(currentVersion)}.${semver.patch(currentVersion)}`;
        return { version: finalized, needsBump: true };
    }
    if (baseline && semver.valid(baseline) && semver.gt(currentVersion, baseline)) {
        return { version: currentVersion, needsBump: false };
    }
    const next = bumpVersion(currentVersion, 'patch');
    return next ? { version: next, needsBump: true } : undefined;
}

/** Next beta: bump the -beta.N counter, or preview the next patch as -beta.0. */
export function computeBetaTarget(currentVersion: string): string | undefined {
    if (!semver.valid(currentVersion)) {
        return undefined;
    }
    if (semver.prerelease(currentVersion)) {
        return semver.inc(currentVersion, 'prerelease', 'beta') ?? undefined;
    }
    const base = bumpVersion(currentVersion, 'patch');
    return base ? `${base}-beta.0` : undefined;
}

/** Rewrites only the version value, preserving the file's formatting. */
function bumpManifestVersion(pkgDir: string, currentVersion: string, newVersion: string): void {
    const file = path.join(pkgDir, 'package.json');
    const raw = fs.readFileSync(file, 'utf8');
    const escaped = currentVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updated = raw.replace(new RegExp(`("version"\\s*:\\s*)"${escaped}"`), `$1"${newVersion}"`);
    if (updated === raw) {
        throw new Error(vscode.l10n.t('Could not update the version in package.json.'));
    }
    fs.writeFileSync(file, updated, 'utf8');
}

async function getDefaultBranch(repoRoot: string): Promise<string> {
    if (await branchExists(repoRoot, 'main')) {
        return 'main';
    }
    if (await branchExists(repoRoot, 'master')) {
        return 'master';
    }
    throw new Error(vscode.l10n.t('No "main" or "master" branch found in this repository.'));
}

function workflowHandlesBeta(workflowPath: string | undefined): boolean {
    if (!workflowPath) {
        return false;
    }
    try {
        return fs.readFileSync(workflowPath, 'utf8').includes('--tag beta');
    } catch {
        return false;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPublish(name: string, version: string): Promise<boolean> {
    const deadline = Date.now() + PUBLISH_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(PUBLISH_POLL_INTERVAL_MS);
        try {
            if (await isVersionPublished(name, version)) {
                return true;
            }
        } catch {
            // registry hiccup — keep polling
        }
    }
    return false;
}

function openUrl(url: string): void {
    void vscode.env.openExternal(vscode.Uri.parse(url));
}

/**
 * Non-blocking release feedback. Fires an immediate actionable notification
 * (tag pushed, CI publishing), then confirms the npm publish in the background.
 * The UI remains locked through that confirmation without blocking this release
 * command for the whole poll or a notification button click.
 */
function announcePublish(
    name: string,
    version: string,
    npmUrl: string,
    actionsUrl: string,
    monitor?: PublishMonitor
): void {
    const openNpm = vscode.l10n.t('Open npm');
    const openActions = vscode.l10n.t('Open GitHub Actions');
    const onChoice = (choice: string | undefined): void => {
        if (choice === openNpm) {
            openUrl(npmUrl);
        } else if (choice === openActions) {
            openUrl(actionsUrl);
        }
    };

    monitor?.onPublishStarted?.(version);

    void vscode.window
        .showInformationMessage(
            vscode.l10n.t('🚀 Released {0} v{1} — GitHub Actions is publishing to npm (usually 1–3 min).', name, version),
            openNpm,
            openActions
        )
        .then(onChoice);

    void waitForPublish(name, version).then((published) => {
        monitor?.onPublishComplete?.(version, published);
        if (published) {
            void vscode.window
                .showInformationMessage(vscode.l10n.t('✅ {0}@{1} is live on npm.', name, version), openNpm, openActions)
                .then(onChoice);
        } else {
            void vscode.window
                .showWarningMessage(
                    vscode.l10n.t('{0} v{1} has not appeared on npm yet — check the GitHub Actions run.', name, version),
                    openActions
                )
                .then(onChoice);
        }
    });
}

function computeReleaseTarget(kind: ReleaseKind, currentVersion: string, baseline: string | undefined): ReleaseTarget {
    if (kind === 'beta') {
        const beta = computeBetaTarget(currentVersion);
        if (!beta) {
            throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', currentVersion));
        }
        return { version: beta, needsBump: true };
    }
    if (kind === 'patch') {
        const target = computeTarget(currentVersion, baseline);
        if (!target) {
            throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', currentVersion));
        }
        return target;
    }
    const bumped = bumpVersion(currentVersion, kind);
    if (!bumped) {
        throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', currentVersion));
    }
    return { version: bumped, needsBump: true };
}

/**
 * Stable: bump+commit on the current branch, merge into main, tag, push, come
 * back — the user never leaves their branch. Beta: bump+tag on the current
 * branch only, no merge. CI publishes on the tag push.
 */
export async function runRelease(
    state: PackageState,
    kind: ReleaseKind,
    monitor?: PublishMonitor
): Promise<void> {
    const repoRoot = state.repoRoot;
    const github = state.github;
    if (!repoRoot || !github) {
        throw new Error(vscode.l10n.t('The package is not ready to release yet.'));
    }

    // The cached state may be minutes old — re-read the version from disk.
    const pkg = readPackageInfo(state.pkg.dir) ?? state.pkg;
    const baseline = state.publishedVersion ?? state.lastTagVersion;
    const target = computeReleaseTarget(kind, pkg.version, baseline);

    if (!(await isWorkingTreeClean(repoRoot))) {
        throw new Error(vscode.l10n.t('You have uncommitted changes. Commit or stash them first.'));
    }

    const tagName = state.tagPattern ? createTagName(state.tagPattern, target.version) : undefined;
    if (!tagName) {
        throw new Error(vscode.l10n.t('The publish workflow does not have a supported tag pattern.'));
    }
    if (await tagExists(repoRoot, tagName)) {
        throw new Error(vscode.l10n.t('Tag {0} already exists. Bump the version in package.json first.', tagName));
    }

    // Pre-flight: no workflow means the pushed tag would never publish to npm.
    if (!state.workflowPath) {
        const proceed = await vscode.window.showWarningMessage(
            vscode.l10n.t(
                'No publish workflow found in .github/workflows — GitHub Actions will not publish this tag to npm. Release anyway?'
            ),
            { modal: true },
            vscode.l10n.t('Release anyway')
        );
        if (!proceed) {
            return;
        }
    }

    if (kind === 'beta' && !workflowHandlesBeta(state.workflowPath)) {
        const proceed = await vscode.window.showWarningMessage(
            vscode.l10n.t(
                'Your publish workflow does not separate beta releases (no "--tag beta"), so this beta would reach all users as the latest version. Continue anyway?'
            ),
            { modal: true },
            vscode.l10n.t('Publish as latest')
        );
        if (!proceed) {
            return;
        }
    }

    const defaultBranch = await getDefaultBranch(repoRoot);
    const originalBranch = await getCurrentBranch(repoRoot);
    if (!isReleaseBranch(originalBranch)) {
        throw new Error(
            vscode.l10n.t('Releases run from "dev" or "main" — you are on "{0}". Switch branch first.', originalBranch)
        );
    }

    const confirm = await vscode.window.showInformationMessage(
        kind === 'beta'
            ? vscode.l10n.t('Release {0} v{1} (beta) from branch "{2}"?', pkg.name, target.version, originalBranch)
            : vscode.l10n.t('Release {0} v{1}?', pkg.name, target.version),
        { modal: true },
        vscode.l10n.t('Release')
    );
    if (!confirm) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Releasing {0} v{1}', pkg.name, target.version),
        },
        async (progress): Promise<void> => {
            if (target.needsBump) {
                progress.report({ message: vscode.l10n.t('updating package.json…') });
                bumpManifestVersion(pkg.dir, pkg.version, target.version);
                await addFile(repoRoot, path.join(pkg.dir, 'package.json'));
                await commit(repoRoot, `⬆️ Update: version v${target.version}`);
                await push(repoRoot, originalBranch);
            }

            if (kind === 'beta') {
                // Betas ship straight from the current branch, main untouched.
                progress.report({ message: vscode.l10n.t('tagging and pushing…') });
                await createTag(repoRoot, tagName);
                await push(repoRoot, originalBranch);
                await pushTag(repoRoot, tagName);
            } else {
                if (originalBranch !== defaultBranch) {
                    progress.report({ message: vscode.l10n.t('merging {0} into {1}…', originalBranch, defaultBranch) });
                    await checkout(repoRoot, defaultBranch);
                    try {
                        await pull(repoRoot, defaultBranch);
                        await merge(repoRoot, originalBranch);
                    } catch (error) {
                        await abortMerge(repoRoot).catch(() => undefined);
                        await checkout(repoRoot, originalBranch).catch(() => undefined);
                        throw error;
                    }
                } else {
                    await pull(repoRoot, defaultBranch);
                }

                try {
                    progress.report({ message: vscode.l10n.t('tagging and pushing to GitHub…') });
                    await createTag(repoRoot, tagName);
                    await push(repoRoot, defaultBranch);
                    await pushTag(repoRoot, tagName);
                } finally {
                    if (originalBranch !== defaultBranch) {
                        await checkout(repoRoot, originalBranch).catch(() => undefined);
                    }
                }

                // Keep the working branch aligned with the release merge; not fatal.
                if (originalBranch !== defaultBranch) {
                    try {
                        await merge(repoRoot, defaultBranch);
                        await push(repoRoot, originalBranch);
                    } catch {
                        void vscode.window.showWarningMessage(
                            vscode.l10n.t(
                                'Released, but "{0}" could not be synced with "{1}". Merge it manually.',
                                originalBranch,
                                defaultBranch
                            )
                        );
                    }
                }
            }

        }
    );

    // Git work is done. Publish confirmation continues in the background.
    const npmUrl = `https://www.npmjs.com/package/${pkg.name}/v/${target.version}`;
    const actionsUrl = `https://github.com/${github.owner}/${github.repo}/actions`;
    announcePublish(pkg.name, target.version, npmUrl, actionsUrl, monitor);
}

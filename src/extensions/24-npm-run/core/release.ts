import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import semver from 'semver';
import { PackageState, isVersionPublished, readPackageInfo } from './detector';
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

export type ReleaseKind = 'stable' | 'beta';

export interface ReleaseTarget {
    version: string;
    /** false = package.json is already ahead of npm (user bumped it manually) */
    needsBump: boolean;
}

const PUBLISH_POLL_INTERVAL_MS = 15000;
const PUBLISH_TIMEOUT_MS = 8 * 60000;

/** Manual bump in package.json wins; otherwise auto patch over the current version. */
export function computeTarget(currentVersion: string, publishedVersion: string | undefined): ReleaseTarget | undefined {
    if (
        publishedVersion &&
        semver.valid(currentVersion) &&
        semver.valid(publishedVersion) &&
        semver.gt(currentVersion, publishedVersion)
    ) {
        return { version: currentVersion, needsBump: false };
    }
    const next = semver.inc(currentVersion, 'patch');
    return next ? { version: next, needsBump: true } : undefined;
}

export function computeBetaTarget(currentVersion: string): string | undefined {
    return semver.inc(currentVersion, 'prerelease', 'beta') ?? undefined;
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

/**
 * Stable: bump+commit on the current branch, merge into main, tag, push,
 * come back — the user never leaves their branch. Beta: bump+tag on the
 * current branch only, no merge. CI publishes on the tag push.
 */
export async function runRelease(state: PackageState, kind: ReleaseKind): Promise<void> {
    const repoRoot = state.repoRoot;
    const github = state.github;
    if (!repoRoot || !github) {
        throw new Error(vscode.l10n.t('The package is not ready to release yet.'));
    }

    // The cached state may be minutes old — re-read the version from disk.
    const pkg = readPackageInfo(state.pkg.dir) ?? state.pkg;

    let target: ReleaseTarget;
    if (kind === 'beta') {
        const beta = computeBetaTarget(pkg.version);
        if (!beta) {
            throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', pkg.version));
        }
        target = { version: beta, needsBump: true };
    } else {
        const stable = computeTarget(pkg.version, state.publishedVersion);
        if (!stable) {
            throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', pkg.version));
        }
        target = stable;
    }

    if (!(await isWorkingTreeClean(repoRoot))) {
        throw new Error(vscode.l10n.t('You have uncommitted changes. Commit or stash them first.'));
    }

    const tagName = `v${target.version}`;
    if (await tagExists(repoRoot, tagName)) {
        throw new Error(vscode.l10n.t('Tag {0} already exists. Bump the version in package.json first.', tagName));
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

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Releasing {0} v{1}', pkg.name, target.version),
        },
        async (progress): Promise<{ published: boolean }> => {
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

            progress.report({ message: vscode.l10n.t('waiting for GitHub Actions to publish (usually 1–3 min)…') });
            const published = await waitForPublish(pkg.name, target.version);
            return { published };
        }
    );

    const npmUrl = `https://www.npmjs.com/package/${pkg.name}/v/${target.version}`;
    const actionsUrl = `https://github.com/${github.owner}/${github.repo}/actions`;
    const openNpm = vscode.l10n.t('Open npm');
    const openActions = vscode.l10n.t('Open GitHub Actions');

    if (result.published) {
        const choice = await vscode.window.showInformationMessage(
            vscode.l10n.t('✅ {0}@{1} published on npm.', pkg.name, target.version),
            openNpm,
            openActions
        );
        if (choice === openNpm) {
            void vscode.env.openExternal(vscode.Uri.parse(npmUrl));
        } else if (choice === openActions) {
            void vscode.env.openExternal(vscode.Uri.parse(actionsUrl));
        }
    } else {
        const choice = await vscode.window.showWarningMessage(
            vscode.l10n.t(
                'Tag v{0} was pushed, but the new version has not appeared on npm yet. Check the GitHub Actions run.',
                target.version
            ),
            openActions
        );
        if (choice === openActions) {
            void vscode.env.openExternal(vscode.Uri.parse(actionsUrl));
        }
    }
}

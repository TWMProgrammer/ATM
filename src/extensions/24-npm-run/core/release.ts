import { execFile } from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import semver from 'semver';
import { PackageState, isVersionPublished, readPackageInfo } from './detector';
import {
    abortMerge,
    branchExists,
    checkout,
    getCurrentBranch,
    isWorkingTreeClean,
    merge,
    pull,
    push,
    pushWithTags,
    tagExists,
} from './git';

export type ReleaseType = 'major' | 'minor' | 'patch' | 'beta';

export interface NextVersions {
    major: string;
    minor: string;
    patch: string;
    beta: string;
}

const PUBLISH_POLL_INTERVAL_MS = 15000;
const PUBLISH_TIMEOUT_MS = 8 * 60000;

export function computeNextVersions(current: string): NextVersions | undefined {
    const major = semver.inc(current, 'major');
    const minor = semver.inc(current, 'minor');
    const patch = semver.inc(current, 'patch');
    const beta = semver.inc(current, 'prerelease', 'beta');
    if (!major || !minor || !patch || !beta) {
        return undefined;
    }
    return { major, minor, patch, beta };
}

/** Suggests a bump type from conventional-style commit subjects (feat:, fix:, BREAKING…). */
export function suggestReleaseType(subjects: string[]): ReleaseType {
    let suggestion: ReleaseType = 'patch';
    for (const subject of subjects) {
        const lower = subject.toLowerCase();
        if (lower.includes('breaking change') || /\w(\(.+\))?!:/.test(lower)) {
            return 'major';
        }
        if (/\bfeat\b/.test(lower)) {
            suggestion = 'minor';
        }
    }
    return suggestion;
}

/** Runs `npm version`, which bumps package.json and creates the commit + matching v-tag. */
function npmVersion(pkgDir: string, type: ReleaseType): Promise<string> {
    const args = type === 'beta' ? ['version', 'prerelease', '--preid', 'beta'] : ['version', type];
    return new Promise((resolve, reject) => {
        execFile('npm', args, { cwd: pkgDir, timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
                return;
            }
            const lines = stdout.trim().split('\n');
            const last = lines[lines.length - 1].trim();
            resolve(last.startsWith('v') ? last.slice(1) : last);
        });
    });
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
 * The whole release: merge the working branch into main, bump + tag with
 * `npm version`, push with tags, and wait for GitHub Actions to publish.
 */
export async function runRelease(state: PackageState, type: ReleaseType): Promise<void> {
    const repoRoot = state.repoRoot;
    const github = state.github;
    if (!repoRoot || !github) {
        throw new Error(vscode.l10n.t('The package is not ready to release yet.'));
    }

    // The cached state may be minutes old — re-read the version from disk.
    const pkg = readPackageInfo(state.pkg.dir) ?? state.pkg;
    const next = computeNextVersions(pkg.version)?.[type];
    if (!next) {
        throw new Error(vscode.l10n.t('Cannot compute the next version from "{0}".', pkg.version));
    }

    if (!(await isWorkingTreeClean(repoRoot))) {
        throw new Error(vscode.l10n.t('You have uncommitted changes. Commit or stash them first.'));
    }

    const tag = `v${next}`;
    if (await tagExists(repoRoot, tag)) {
        throw new Error(vscode.l10n.t('Tag {0} already exists.', tag));
    }

    if (type === 'beta' && !workflowHandlesBeta(state.workflowPath)) {
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

    if (originalBranch !== defaultBranch && originalBranch !== 'dev') {
        const proceed = await vscode.window.showWarningMessage(
            vscode.l10n.t('You are on branch "{0}". Merge it into "{1}" and release v{2}?', originalBranch, defaultBranch, next),
            { modal: true },
            vscode.l10n.t('Merge & Release')
        );
        if (!proceed) {
            return;
        }
    }

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Releasing {0} v{1}', pkg.name, next),
        },
        async (progress): Promise<{ version: string; published: boolean }> => {
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
            }

            let newVersion: string;
            try {
                progress.report({ message: vscode.l10n.t('bumping version and tagging…') });
                newVersion = await npmVersion(pkg.dir, type);

                progress.report({ message: vscode.l10n.t('pushing to GitHub…') });
                await pushWithTags(repoRoot, defaultBranch);
            } finally {
                if (originalBranch !== defaultBranch) {
                    await checkout(repoRoot, originalBranch).catch(() => undefined);
                }
            }

            // Keep dev aligned with the release commit; a failure here is not fatal.
            if (originalBranch === 'dev') {
                try {
                    await merge(repoRoot, defaultBranch);
                    await push(repoRoot, 'dev');
                } catch {
                    void vscode.window.showWarningMessage(
                        vscode.l10n.t('Released, but "dev" could not be synced with "{0}". Merge it manually.', defaultBranch)
                    );
                }
            }

            progress.report({ message: vscode.l10n.t('waiting for GitHub Actions to publish (usually 1–3 min)…') });
            const published = await waitForPublish(pkg.name, newVersion);
            return { version: newVersion, published };
        }
    );

    const npmUrl = `https://www.npmjs.com/package/${pkg.name}/v/${result.version}`;
    const actionsUrl = `https://github.com/${github.owner}/${github.repo}/actions`;
    const openNpm = vscode.l10n.t('Open npm');
    const openActions = vscode.l10n.t('Open GitHub Actions');

    if (result.published) {
        const choice = await vscode.window.showInformationMessage(
            vscode.l10n.t('✅ {0}@{1} published on npm.', pkg.name, result.version),
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
                result.version
            ),
            openActions
        );
        if (choice === openActions) {
            void vscode.env.openExternal(vscode.Uri.parse(actionsUrl));
        }
    }
}

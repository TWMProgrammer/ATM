import { execFile } from 'child_process';
import { versionFromTag } from './workflow';

const GIT_TIMEOUT_MS = 30000;

export interface GitHubRepo {
    owner: string;
    repo: string;
}

export function runGit(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr.trim() || error.message));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export async function getRepoRoot(dir: string): Promise<string | undefined> {
    try {
        return await runGit(dir, ['rev-parse', '--show-toplevel']);
    } catch {
        return undefined;
    }
}

export function getCurrentBranch(repoRoot: string): Promise<string> {
    return runGit(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export async function isWorkingTreeClean(repoRoot: string): Promise<boolean> {
    return (await runGit(repoRoot, ['status', '--porcelain'])) === '';
}

export async function getRemoteUrl(repoRoot: string): Promise<string | undefined> {
    try {
        return await runGit(repoRoot, ['remote', 'get-url', 'origin']);
    } catch {
        return undefined;
    }
}

export function parseGitHubRepo(url: string | undefined): GitHubRepo | undefined {
    if (!url) {
        return undefined;
    }
    const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!match) {
        return undefined;
    }
    return { owner: match[1], repo: match[2] };
}

export async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
    try {
        await runGit(repoRoot, ['rev-parse', '--verify', `refs/heads/${branch}`]);
        return true;
    } catch {
        return false;
    }
}

export async function tagExists(repoRoot: string, tag: string): Promise<boolean> {
    try {
        await runGit(repoRoot, ['rev-parse', '--verify', `refs/tags/${tag}`]);
        return true;
    } catch {
        return false;
    }
}

/** Latest package-specific tag as a bare version; offline baseline for manual-bump detection. */
export async function getLastTagVersion(repoRoot: string, tagPattern: string): Promise<string | undefined> {
    try {
        const output = await runGit(repoRoot, ['tag', '--list', tagPattern, '--sort=-version:refname']);
        for (const tag of output.split('\n')) {
            const version = versionFromTag(tagPattern, tag.trim());
            if (version) {
                return version;
            }
        }
        return undefined;
    } catch {
        return undefined;
    }
}

export function checkout(repoRoot: string, branch: string): Promise<string> {
    return runGit(repoRoot, ['checkout', branch]);
}

export function pull(repoRoot: string, branch: string): Promise<string> {
    return runGit(repoRoot, ['pull', 'origin', branch]);
}

export function merge(repoRoot: string, branch: string): Promise<string> {
    return runGit(repoRoot, ['merge', '--no-edit', branch]);
}

export function abortMerge(repoRoot: string): Promise<string> {
    return runGit(repoRoot, ['merge', '--abort']);
}

export function addFile(repoRoot: string, filePath: string): Promise<string> {
    return runGit(repoRoot, ['add', filePath]);
}

export function commit(repoRoot: string, message: string): Promise<string> {
    return runGit(repoRoot, ['commit', '-m', message]);
}

export function createTag(repoRoot: string, tag: string): Promise<string> {
    return runGit(repoRoot, ['tag', tag]);
}

export function push(repoRoot: string, branch: string): Promise<string> {
    return runGit(repoRoot, ['push', 'origin', branch]);
}

// Explicit push: --follow-tags skips lightweight tags, so push the tag by name.
export function pushTag(repoRoot: string, tag: string): Promise<string> {
    return runGit(repoRoot, ['push', 'origin', tag]);
}

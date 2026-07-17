import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitHubRepo, getCurrentBranch, getLastTagVersion, getRemoteUrl, getRepoRoot, parseGitHubRepo } from './git';
import { findPublishWorkflows, findWorkflowForPackage } from './workflow';

export interface PackageInfo {
    /** Absolute path of the folder containing package.json */
    dir: string;
    name: string;
    version: string;
}

export type ReadinessIssue =
    | 'no-git-repo'
    | 'no-github-remote'
    | 'no-publish-workflow'
    | 'no-package-workflow'
    | 'unsupported-tag-pattern'
    | 'monorepo-root'
    | 'legacy-publish-auth';

export interface PackageState {
    pkg: PackageInfo;
    repoRoot?: string;
    github?: GitHubRepo;
    workflowPath?: string;
    tagPattern?: string;
    currentBranch?: string;
    /** Latest on npm; undefined = never published OR registry unreachable */
    publishedVersion?: string;
    /** Last git tag version — offline baseline for manual-bump detection */
    lastTagVersion?: string;
    issues: ReadinessIssue[];
}

function readManifest(dir: string): Record<string, unknown> | undefined {
    try {
        const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}

function toPackageInfo(dir: string, manifest: Record<string, unknown>): PackageInfo | undefined {
    const name = manifest['name'];
    const version = manifest['version'];
    if (typeof name !== 'string' || typeof version !== 'string') {
        return undefined;
    }
    if (manifest['private'] === true) {
        return undefined;
    }
    // VS Code extensions publish to a marketplace, not to npm.
    const engines = manifest['engines'];
    if (engines && typeof engines === 'object' && 'vscode' in engines) {
        return undefined;
    }
    if (!manifest['publishConfig']) {
        return undefined;
    }
    return { dir, name, version };
}

export function readPackageInfo(dir: string): PackageInfo | undefined {
    const manifest = readManifest(dir);
    return manifest ? toPackageInfo(dir, manifest) : undefined;
}

/**
 * Finds the first publishable npm package in the workspace: the workspace
 * root itself, or one folder deep (a package living inside a bigger project).
 */
export function findPublishablePackage(): PackageInfo | undefined {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
        const root = folder.uri.fsPath;
        const rootManifest = readManifest(root);
        if (rootManifest) {
            const info = toPackageInfo(root, rootManifest);
            if (info) {
                return info;
            }
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue;
            }
            const dir = path.join(root, entry.name);
            const manifest = readManifest(dir);
            if (!manifest) {
                continue;
            }
            const info = toPackageInfo(dir, manifest);
            if (info) {
                return info;
            }
        }
    }
    return undefined;
}

function httpGetStatus(url: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { accept: 'application/json' }, timeout: 10000 }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => {
                body += chunk;
            });
            response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
        });
        request.on('timeout', () => request.destroy(new Error('npm registry request timed out')));
        request.on('error', reject);
    });
}

/** Latest version on npm, or undefined when the package has never been published. */
export async function getLatestPublishedVersion(name: string): Promise<string | undefined> {
    const { status, body } = await httpGetStatus(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
    if (status === 404) {
        return undefined;
    }
    if (status !== 200) {
        throw new Error(`npm registry answered ${status}`);
    }
    const parsed: unknown = JSON.parse(body);
    const version = (parsed as { version?: unknown }).version;
    return typeof version === 'string' ? version : undefined;
}

export async function isVersionPublished(name: string, version: string): Promise<boolean> {
    const { status } = await httpGetStatus(
        `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
    );
    return status === 200;
}

export function usesLegacyNpmToken(content: string): boolean {
    return /NODE_AUTH_TOKEN:[ \t]*\$\{\{[ \t]*secrets\.NPM_TOKEN[ \t]*\}\}/.test(content);
}

function workflowUsesLegacyNpmToken(filePath: string): boolean {
    try {
        return usesLegacyNpmToken(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return false;
    }
}

export async function analyzePackageState(pkg: PackageInfo): Promise<PackageState> {
    const issues: ReadinessIssue[] = [];
    const state: PackageState = { pkg, issues };

    try {
        state.publishedVersion = await getLatestPublishedVersion(pkg.name);
    } catch {
        // offline / registry hiccup — baseline falls back to the last git tag
    }

    state.repoRoot = await getRepoRoot(pkg.dir);
    if (!state.repoRoot) {
        issues.push('no-git-repo');
        return state;
    }

    state.currentBranch = await getCurrentBranch(state.repoRoot).catch(() => undefined);

    const remoteUrl = await getRemoteUrl(state.repoRoot);
    state.github = parseGitHubRepo(remoteUrl);
    if (!state.github) {
        issues.push('no-github-remote');
        return state;
    }

    const workflows = findPublishWorkflows(state.repoRoot);
    const workflow = findWorkflowForPackage(workflows, state.repoRoot, pkg.dir);
    if (!workflow) {
        const packageIsRepoRoot = path.resolve(pkg.dir) === path.resolve(state.repoRoot);
        if (packageIsRepoRoot && workflows.some((candidate) => candidate.workingDirectory !== undefined)) {
            issues.push('monorepo-root');
        } else if (packageIsRepoRoot && workflows.length === 0) {
            issues.push('no-publish-workflow');
        } else {
            issues.push('no-package-workflow');
        }
        return state;
    }

    state.workflowPath = workflow.filePath;
    state.tagPattern = workflow.tagPattern;
    if (!state.tagPattern) {
        issues.push('unsupported-tag-pattern');
    } else if (workflowUsesLegacyNpmToken(state.workflowPath)) {
        issues.push('legacy-publish-auth');
    } else {
        state.lastTagVersion = await getLastTagVersion(state.repoRoot, state.tagPattern);
    }

    return state;
}

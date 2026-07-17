import * as fs from 'fs';
import * as path from 'path';

export interface PublishWorkflow {
    filePath: string;
    /** Static package directory used by the publish step, relative to the repository root. */
    workingDirectory?: string;
    /** Supported tag glob with one trailing wildcard, for example v* or cli-v*. */
    tagPattern?: string;
}

function unquote(value: string): string {
    const trimmed = value.trim();
    if (
        trimmed.length >= 2 &&
        ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function normalizeRelativeDirectory(value: string): string | undefined {
    const unquoted = unquote(value);
    if (!unquoted || unquoted.includes('${{')) {
        return undefined;
    }
    const normalized = path.posix.normalize(unquoted.replace(/\\/g, '/')).replace(/^\.\//, '').replace(/\/$/, '');
    return normalized === '.' ? undefined : normalized;
}

function extractTagPatterns(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const patterns: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const match = /^(\s*)tags:\s*(.*)$/.exec(lines[index]);
        if (!match) {
            continue;
        }

        const indentation = match[1].length;
        const inline = match[2].trim();
        if (inline.startsWith('[') && inline.endsWith(']')) {
            for (const value of inline.slice(1, -1).split(',')) {
                const pattern = unquote(value);
                if (pattern) {
                    patterns.push(pattern);
                }
            }
            continue;
        }
        if (inline) {
            patterns.push(unquote(inline));
            continue;
        }

        for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
            const child = lines[childIndex];
            if (!child.trim()) {
                continue;
            }
            const childIndentation = /^\s*/.exec(child)?.[0].length ?? 0;
            if (childIndentation <= indentation) {
                break;
            }
            const item = /^\s*-\s*(.+?)\s*$/.exec(child);
            if (item) {
                patterns.push(unquote(item[1]));
            }
        }
    }

    return patterns;
}

function isSupportedTagPattern(pattern: string): boolean {
    return !pattern.startsWith('!') && pattern.endsWith('*') && pattern.indexOf('*') === pattern.length - 1;
}

function extractPublishWorkingDirectory(content: string): string | undefined {
    const lines = content.split(/\r?\n/);
    let currentItem: string[] = [];
    let currentIndentation: number | undefined;

    const finishItem = (): string | undefined => {
        if (!currentItem.some((line) => /\b(?:npm|bun)\s+publish\b/.test(line))) {
            return undefined;
        }
        for (const line of currentItem) {
            const match = /^\s*working-directory:\s*(.+?)\s*$/.exec(line);
            if (match) {
                return normalizeRelativeDirectory(match[1]);
            }
        }
        return undefined;
    };

    for (const line of lines) {
        const item = /^(\s*)-\s+/.exec(line);
        if (item && (currentIndentation === undefined || item[1].length <= currentIndentation)) {
            const directory = finishItem();
            if (currentItem.some((entry) => /\b(?:npm|bun)\s+publish\b/.test(entry))) {
                return directory;
            }
            currentItem = [line];
            currentIndentation = item[1].length;
        } else if (currentIndentation !== undefined) {
            currentItem.push(line);
        }
    }

    return finishItem();
}

/** Parses the focused subset of GitHub Actions used to publish one npm package. */
export function parsePublishWorkflow(filePath: string, content: string): PublishWorkflow | undefined {
    if (!/\b(?:npm|bun)\s+publish\b/.test(content)) {
        return undefined;
    }
    return {
        filePath,
        workingDirectory: extractPublishWorkingDirectory(content),
        tagPattern: extractTagPatterns(content).find(isSupportedTagPattern),
    };
}

export function findPublishWorkflows(repoRoot: string): PublishWorkflow[] {
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    let entries: string[];
    try {
        entries = fs.readdirSync(workflowsDir).sort();
    } catch {
        return [];
    }

    const workflows: PublishWorkflow[] = [];
    for (const entry of entries) {
        if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) {
            continue;
        }
        const filePath = path.join(workflowsDir, entry);
        try {
            const workflow = parsePublishWorkflow(filePath, fs.readFileSync(filePath, 'utf8'));
            if (workflow) {
                workflows.push(workflow);
            }
        } catch {
            // Unreadable or malformed workflow — keep looking.
        }
    }
    return workflows;
}

export function findWorkflowForPackage(
    workflows: PublishWorkflow[],
    repoRoot: string,
    packageDir: string
): PublishWorkflow | undefined {
    const relativePackageDir = path.relative(repoRoot, packageDir).replace(/\\/g, '/') || '.';
    return workflows.find((workflow) => {
        if (relativePackageDir === '.') {
            return workflow.workingDirectory === undefined;
        }
        return workflow.workingDirectory === relativePackageDir;
    });
}

export function createTagName(tagPattern: string, version: string): string | undefined {
    if (!isSupportedTagPattern(tagPattern)) {
        return undefined;
    }
    return `${tagPattern.slice(0, -1)}${version}`;
}

export function versionFromTag(tagPattern: string, tag: string): string | undefined {
    if (!isSupportedTagPattern(tagPattern)) {
        return undefined;
    }
    const prefix = tagPattern.slice(0, -1);
    return tag.startsWith(prefix) ? tag.slice(prefix.length) : undefined;
}

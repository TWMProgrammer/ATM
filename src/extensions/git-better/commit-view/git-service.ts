import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { LRUCache } from './utils';

const execAsync = promisify(exec);

export interface GitCommitInfo {
    hash: string;
    authorName: string;
    authorEmail: string;
    date: Date;
    summary: string;
    parentHash?: string | null;
}

export interface BlameLineInfo {
    commitHash: string;
    originalLine: number;
    finalLine: number;
}

export interface LineDiffInfo {
    previous: string | null;
    current: string | null;
}

const MAX_COMMIT_CACHE = 500;
const MAX_FILE_BLAME_CACHE = 30;
const MAX_DIFF_CACHE = 200;

export class GitService {
    private fileBlameCache = new LRUCache<string, Map<number, BlameLineInfo>>(MAX_FILE_BLAME_CACHE);
    private commitCache = new LRUCache<string, GitCommitInfo>(MAX_COMMIT_CACHE);
    private diffCache = new LRUCache<string, LineDiffInfo | null>(MAX_DIFF_CACHE);
    private pendingRequests = new Map<string, Promise<void>>();

    public getBlameLineInfo(filepath: string, line: number): BlameLineInfo | undefined {
        return this.fileBlameCache.get(filepath)?.get(line);
    }

    public getCommitInfo(hash: string): GitCommitInfo | undefined {
        return this.commitCache.get(hash);
    }

    public hasFileBlame(filepath: string): boolean {
        return this.fileBlameCache.has(filepath);
    }

    /** Invalidate blame cache for a specific file (e.g. on save). */
    public invalidateFile(filepath: string): void {
        this.fileBlameCache.delete(filepath);
    }

    /** Clear all caches (e.g. on repository change). */
    public clearAll(): void {
        this.fileBlameCache.clear();
        this.commitCache.clear();
        this.diffCache.clear();
        this.pendingRequests.clear();
    }

    public async blameFile(filepath: string): Promise<void> {
        if (this.pendingRequests.has(filepath)) {
            return this.pendingRequests.get(filepath)!;
        }

        const request = this._executeBlame(filepath).finally(() => {
            this.pendingRequests.delete(filepath);
        });

        this.pendingRequests.set(filepath, request);
        return request;
    }

    private async _executeBlame(filepath: string): Promise<void> {
        try {
            const cwd = path.dirname(filepath);
            const filename = path.basename(filepath);
            const { stdout } = await execAsync(
                `git blame --line-porcelain -- "${filename}"`,
                { cwd, maxBuffer: 10 * 1024 * 1024 }
            );
            this.parseBlamePorcelain(filepath, stdout);
        } catch (error) {
            console.error(`Git blame failed for file ${filepath}:`, error);
        }
    }

    private parseBlamePorcelain(filepath: string, gitOutput: string) {
        const lines = gitOutput.split('\n');
        let currentCommitHash = '';
        let currentCommitInfo: Partial<GitCommitInfo> = {};
        const fileCache = new Map<number, BlameLineInfo>();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matchHeader = line.match(/^([a-f0-9]{40})\s+(\d+)\s+(\d+)/);

            if (matchHeader) {
                currentCommitHash = matchHeader[1];
                const finalLine = parseInt(matchHeader[3], 10);

                fileCache.set(finalLine, {
                    commitHash: currentCommitHash,
                    originalLine: parseInt(matchHeader[2], 10),
                    finalLine: finalLine,
                });

                if (!this.commitCache.has(currentCommitHash)) {
                    currentCommitInfo = { hash: currentCommitHash };
                }
                continue;
            }

            if (currentCommitHash && !this.commitCache.has(currentCommitHash)) {
                if (line.startsWith('author ')) {
                    currentCommitInfo.authorName = line.substring(7);
                } else if (line.startsWith('author-mail ')) {
                    currentCommitInfo.authorEmail = line.substring(12).replace(/[<>]/g, '');
                } else if (line.startsWith('author-time ')) {
                    currentCommitInfo.date = new Date(parseInt(line.substring(12), 10) * 1000);
                } else if (line.startsWith('summary ')) {
                    currentCommitInfo.summary = line.substring(8);

                    if (
                        currentCommitInfo.hash &&
                        currentCommitInfo.authorName &&
                        currentCommitInfo.authorEmail &&
                        currentCommitInfo.date &&
                        currentCommitInfo.summary
                    ) {
                        this.commitCache.set(currentCommitHash, currentCommitInfo as GitCommitInfo);
                    }
                }
            }
        }

        this.fileBlameCache.set(filepath, fileCache);
    }

    public async getLineDiff(
        filepath: string,
        commitHash: string,
        originalLine: number
    ): Promise<LineDiffInfo | null> {
        if (commitHash === '0000000000000000000000000000000000000000') {
            return null;
        }

        const cacheKey = `${commitHash}:${path.basename(filepath)}:${originalLine}`;
        const cached = this.diffCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        try {
            const cwd = path.dirname(filepath);
            const filename = path.basename(filepath);
            const { stdout } = await execAsync(
                `git show ${commitHash} --no-color -U3 -- "${filename}"`,
                { cwd, maxBuffer: 5 * 1024 * 1024 }
            );
            const result = this.extractLineDiffFromShow(stdout, originalLine);
            this.diffCache.set(cacheKey, result);
            return result;
        } catch {
            this.diffCache.set(cacheKey, null);
            return null;
        }
    }

    public async getPreviousCommitHash(
        filepath: string,
        commitHash: string
    ): Promise<string | null> {
        if (commitHash === '0000000000000000000000000000000000000000') {
            return null;
        }

        const cachedCommit = this.commitCache.get(commitHash);
        if (cachedCommit && cachedCommit.parentHash !== undefined) {
            return cachedCommit.parentHash;
        }

        try {
            const cwd = path.dirname(filepath);
            const { stdout } = await execAsync(`git rev-parse ${commitHash}~1`, { cwd });
            const parentHash = stdout.trim() || null;
            if (cachedCommit) {
                cachedCommit.parentHash = parentHash;
            }
            return parentHash;
        } catch {
            if (cachedCommit) {
                cachedCommit.parentHash = null;
            }
            return null;
        }
    }

    private extractLineDiffFromShow(showOutput: string, targetLine: number): LineDiffInfo | null {
        const lines = showOutput.split('\n');
        let inDiff = false;
        let currentNewLine = 0;
        let previous: string | null = null;
        let current: string | null = null;

        for (const line of lines) {
            const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
            if (hunkMatch) {
                inDiff = true;
                currentNewLine = parseInt(hunkMatch[1], 10);
                continue;
            }

            if (!inDiff) { continue; }

            if (line.startsWith('-')) {
                if (currentNewLine === targetLine || currentNewLine === targetLine + 1) {
                    previous = line.substring(1);
                }
            } else if (line.startsWith('+')) {
                if (currentNewLine === targetLine) {
                    current = line.substring(1);
                }
                currentNewLine++;
            } else {
                currentNewLine++;
            }

            if (previous !== null && current !== null) { break; }
        }

        if (previous === null && current === null) { return null; }
        return { previous, current };
    }

    public async getCommitUrl(filepath: string, commitHash: string): Promise<string | null> {
        try {
            const cwd = path.dirname(filepath);
            const { stdout } = await execAsync('git config --get remote.origin.url', { cwd });
            let url = stdout.trim();
            if (!url) { return null; }

            url = url.replace(/\.git$/, '');
            if (url.startsWith('git@')) {
                url = url.replace(':', '/').replace('git@', 'https://');
            }

            return `${url}/commit/${commitHash}`;
        } catch {
            return null;
        }
    }
}

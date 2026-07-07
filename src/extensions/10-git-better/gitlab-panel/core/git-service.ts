import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

const execAsync = promisify(exec);
import * as https from 'https';

const GIT_HASH_RE = /^[0-9a-f]{4,40}$/i;

/** Rejects anything that isn't a plain hex commit hash before it reaches a shell string. */
function isValidCommitHash(hash: string): boolean {
    return GIT_HASH_RE.test(hash);
}

/** Rejects non-integer or out-of-range pagination values before they reach a shell string. */
function isValidPagingValue(value: number, max: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= max;
}

function fetchGithubAvatar(owner: string, repo: string, hash: string): Promise<string | null> {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/commits/${hash}`,
            method: 'GET',
            headers: { 'User-Agent': 'VSCode-Git-Better' }
        };
        https.get(options, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json?.author?.avatar_url || json?.committer?.avatar_url || null);
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

export class GraphGitService {
    private static getGravatarUrl(email: string): string {
        if (!email) {
            return '';
        }
        const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
        return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=40`;
    }

    /**
     * Extract the latest commit data in a format suitable for the Inspect panel
     */
    public static async getLatestCommit(): Promise<any | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            // 1. Get standard commit info
            // %H = full hash
            // %an = author name
            // %s = subject
            // %ar = relative date
            const { stdout: commitInfo } = await execAsync('git log -1 --format="%H%n%an%n%s%n%ar"', { cwd });
            const [hash, authorName, message, date] = commitInfo.trim().split('\n');

            // 2. Get line additions/deletions stats
            const { stdout: numstat } = await execAsync('git log -1 --format="" --numstat', { cwd });
            let added = 0;
            let deleted = 0;
            numstat.trim().split('\n').forEach(line => {
                if (!line) { return; }
                const [adds, dels] = line.split('\t');
                if (adds !== '-') { added += parseInt(adds, 10); }
                if (dels !== '-') { deleted += parseInt(dels, 10); }
            });

            // 3. Get changed files
            const { stdout: nameStatus } = await execAsync('git log -1 --format="" --name-status', { cwd });
            const files = nameStatus.trim().split('\n').filter(Boolean).map(line => {
                const [status, ...nameParts] = line.split('\t');
                let name = nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'unknown';
                return {
                    status: status.charAt(0), // 'A', 'M', 'D', 'R', etc.
                    name
                };
            });

            // 4. Get remote origin URL
            let repoUrl = '';
            let authorAvatarUrl = null;
            try {
                const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd });
                let rawUrl = remoteUrl.trim();
                if (rawUrl.startsWith('git@')) {
                    rawUrl = rawUrl.replace(':', '/').replace('git@', 'https://');
                }
                if (rawUrl.endsWith('.git')) {
                    rawUrl = rawUrl.slice(0, -4);
                }
                repoUrl = rawUrl;

                if (repoUrl && repoUrl.includes('github.com')) {
                    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                    if (match) {
                        const owner = match[1];
                        const repo = match[2];
                        authorAvatarUrl = await fetchGithubAvatar(owner, repo, hash);
                    }
                }
            } catch (e) {
                // Not a fatal error if there is no remote origin
            }

            return {
                hash,
                authorName,
                authorAvatar: authorName.charAt(0).toUpperCase(), // fallback to initial
                authorAvatarUrl,
                message,
                date,
                stats: { added, deleted },
                files,
                githubUrl: repoUrl ? `${repoUrl}/commit/${hash}` : null
            };
        } catch (error) {
            console.error('Failed to get latest commit from git:', error);
            return null;
        }
    }

    /**
     * Get detailed commit data for a specific hash (for Inspect panel).
     */
    public static async getCommitByHash(commitHash: string): Promise<any | null> {
        if (!isValidCommitHash(commitHash)) {
            return null;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            // Run all git commands in parallel for speed
            const [commitInfoResult, numstatResult, nameStatusResult, remoteResult] = await Promise.all([
                execAsync(`git log -1 --format="%H%n%an%n%ae%n%s%n%ar" ${commitHash}`, { cwd }),
                execAsync(`git log -1 --format="" --numstat ${commitHash}`, { cwd }),
                execAsync(`git log -1 --format="" --name-status ${commitHash}`, { cwd }),
                execAsync('git config --get remote.origin.url', { cwd }).catch(() => ({ stdout: '' })),
            ]);

            const [hash, authorName, authorEmail, message, date] = commitInfoResult.stdout.trim().split('\n');

            // Parse stats
            let added = 0;
            let deleted = 0;
            numstatResult.stdout.trim().split('\n').forEach(line => {
                if (!line) { return; }
                const [adds, dels] = line.split('\t');
                if (adds !== '-') { added += parseInt(adds, 10); }
                if (dels !== '-') { deleted += parseInt(dels, 10); }
            });

            // Parse files
            const files = nameStatusResult.stdout.trim().split('\n').filter(Boolean).map(line => {
                const [status, ...nameParts] = line.split('\t');
                return {
                    status: status.charAt(0),
                    name: nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'unknown'
                };
            });

            // Parse remote URL and fetch avatar
            let repoUrl = '';
            let authorAvatarUrl = null;
            const rawUrl = remoteResult.stdout.trim();
            if (rawUrl) {
                let url = rawUrl;
                if (url.startsWith('git@')) {
                    url = url.replace(':', '/').replace('git@', 'https://');
                }
                if (url.endsWith('.git')) {
                    url = url.slice(0, -4);
                }
                repoUrl = url;

                if (repoUrl.includes('github.com')) {
                    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                    if (match) {
                        authorAvatarUrl = await fetchGithubAvatar(match[1], match[2], hash);
                    }
                }
            }

            return {
                hash,
                authorName,
                authorAvatar: authorName.charAt(0).toUpperCase(),
                authorAvatarUrl,
                message,
                date,
                stats: { added, deleted },
                files,
                githubUrl: repoUrl ? `${repoUrl}/commit/${hash}` : null
            };
        } catch (error) {
            console.error(`Failed to get commit ${commitHash}:`, error);
            return null;
        }
    }

    /**
     * Extracts a timeline of commits for the graphics sparkline panel.
     * Returns an array mapping commit metrics oldest-to-newest.
     */
    public static async getGraphicsTimeline(limit: number = 30): Promise<any[] | null> {
        if (!isValidPagingValue(limit, 500) || limit === 0) {
            return null;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync(`git log -${limit} --format="COMMIT|%H|%at|%an|%ar" --shortstat`, { cwd });
            const timeline: any[] = [];

            const blocks = stdout.split('COMMIT|').filter(Boolean);
            let isHead = true;

            for (const block of blocks) {
                const lines = block.trim().split('\n');
                if (lines.length === 0) {
                    continue;
                }

                const [hash, timestampStr, author, date] = lines[0].split('|');
                let linesChanged = 0;

                if (lines.length > 1) {
                    const statLine = lines[lines.length - 1];
                    const insertionsMatch = statLine.match(/(\d+) insertion/);
                    const deletionsMatch = statLine.match(/(\d+) deletion/);

                    const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
                    const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;

                    linesChanged = insertions + deletions;
                }

                timeline.push({
                    hash,
                    timestamp: parseInt(timestampStr, 10),
                    author,
                    date,
                    linesChanged,
                    isHead
                });
                isHead = false;
            }

            // Reverse to display oldest first (left) to newest last (right)
            return timeline.reverse();
        } catch (error) {
            console.error('Failed to get graphics timeline from git:', error);
            return null;
        }
    }

    /**
     * Extracts global metrics for the sidebar (branches, commits, tags, stashes)
     */
    public static async getGlobalStats(): Promise<any | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            // Counts only non-empty lines from stdout (avoids wc -l noise)
            const countOutput = async (cmd: string): Promise<number> => {
                try {
                    const { stdout } = await execAsync(cmd, { cwd });
                    return stdout.trim().split('\n').filter(Boolean).length;
                } catch {
                    return 0;
                }
            };

            // Counts a single numeric value from stdout (e.g. git rev-list --count)
            const countValue = async (cmd: string): Promise<number> => {
                try {
                    const { stdout } = await execAsync(cmd, { cwd });
                    const val = parseInt(stdout.trim(), 10);
                    return isNaN(val) ? 0 : val;
                } catch {
                    return 0;
                }
            };

            // Helper: run command and count non-empty, filtered lines
            const countFiltered = async (cmd: string, exclude?: string): Promise<number> => {
                try {
                    const { stdout } = await execAsync(cmd, { cwd });
                    const lines = stdout.trim().split('\n').filter(Boolean);
                    return exclude ? lines.filter(l => !l.includes(exclude)).length : lines.length;
                } catch {
                    return 0;
                }
            };

            // Run ALL commands in parallel for maximum speed
            const [branches, commits, tags, stashes] = await Promise.all([
                // 1. Branches: remote only (matches GitHub/GitLab UI), exclude HEAD pointer
                countFiltered("git branch -r --format='%(refname:short)'", 'HEAD'),
                // 2. Commits: exact count on current branch
                countValue('git rev-list --count HEAD'),
                // 3. Tags: local tags (instant, no network needed)
                countFiltered("git tag --list --format='%(refname:short)'"),
                // 4. Stashes: local stash list (always accurate)
                countFiltered('git stash list'),
            ]);

            return { branches, commits, tags, stashes };
        } catch (error) {
            console.error('Failed to get global stats from git:', error);
            return null;
        }
    }

    /**
     * Fetch a page of commits for the commits table (paginated).
     * @param skip  Number of commits to skip (for pagination)
     * @param limit Number of commits to fetch per page
     */
    public static async getCommitPage(skip: number = 0, limit: number = 25): Promise<any[] | null> {
        if (!isValidPagingValue(skip, 100000) || !isValidPagingValue(limit, 500) || limit === 0) {
            return null;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            // Get current branch name and HEAD hash for marking
            const { stdout: headBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
            const currentBranch = headBranch.trim();

            const { stdout: headHash } = await execAsync('git rev-parse HEAD', { cwd });
            const headCommitHash = headHash.trim();

            // Fetch commits with separator for reliable parsing
            const sep = '---COMMIT_SEP---';
            const format = `${sep}%H|%h|%an|%ae|%cn|%ce|%s|%ar|%D`;
            const { stdout } = await execAsync(
                `git log --all --skip=${skip} -${limit} --format="${format}" --shortstat`,
                { cwd }
            );

            const commits: any[] = [];
            const blocks = stdout.split(sep).filter(Boolean);

            for (const block of blocks) {
                const lines = block.trim().split('\n');
                if (lines.length === 0) { continue; }

                const [hash, hashShort, authorName, authorEmail, committerName, committerEmail, message, date, refs] = lines[0].split('|');

                // Parse --shortstat line for files changed
                let filesChanged = 0;
                if (lines.length > 1) {
                    const statLine = lines[lines.length - 1];
                    const filesMatch = statLine.match(/(\d+) file/);
                    if (filesMatch) {
                        filesChanged = parseInt(filesMatch[1], 10);
                    }
                }

                // Determine branch from refs (e.g. "HEAD -> main, origin/main")
                let branch = '';
                if (refs) {
                    const refParts = refs.split(',').map(r => r.trim());
                    for (const ref of refParts) {
                        const cleaned = ref.replace('HEAD -> ', '').trim();
                        if (cleaned && !cleaned.startsWith('origin/') && !cleaned.includes('tag:')) {
                            branch = cleaned;
                            break;
                        }
                    }
                }

                commits.push({
                    hash,
                    hashShort,
                    authorName,
                    authorEmail,
                    authorAvatarUrl: GraphGitService.getGravatarUrl(authorEmail),
                    committerName,
                    committerEmail,
                    committerAvatarUrl: GraphGitService.getGravatarUrl(committerEmail),
                    authorInitial: authorName ? authorName.charAt(0).toUpperCase() : '?',
                    message,
                    date,
                    filesChanged,
                    branch,
                    isHead: hash === headCommitHash,
                });
            }

            return commits;
        } catch (error) {
            console.error('Failed to get commit page from git:', error);
            return null;
        }
    }
}

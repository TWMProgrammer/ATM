import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);
import * as https from 'https';

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
     * Extracts a timeline of commits for the graphics sparkline panel.
     * Returns an array mapping commit metrics oldest-to-newest.
     */
    public static async getGraphicsTimeline(limit: number = 30): Promise<any[] | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync(`git log -${limit} --format="COMMIT|%H|%at" --shortstat`, { cwd });
            const timeline: any[] = [];

            const blocks = stdout.split('COMMIT|').filter(Boolean);
            let isHead = true;

            for (const block of blocks) {
                const lines = block.trim().split('\n');
                if (lines.length === 0) {
                    continue;
                }

                const [hash, timestampStr] = lines[0].split('|');
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
}

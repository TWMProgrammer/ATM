import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

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

            return {
                hash,
                authorName,
                authorAvatar: authorName.charAt(0).toUpperCase(), // fallback to initial
                message,
                date,
                stats: { added, deleted },
                files
            };
        } catch (error) {
            console.error('Failed to get latest commit from git:', error);
            return null;
        }
    }
}

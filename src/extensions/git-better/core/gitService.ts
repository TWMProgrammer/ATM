import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { GitCommitInfo, BlameLineInfo, LineDiffInfo } from './types';
import { CacheManager } from './cacheManager';

const execAsync = promisify(exec);

export class GitService {
  private cache: CacheManager;

  constructor() {
    this.cache = new CacheManager();
  }

  public getCache() {
    return this.cache;
  }

  /**
   * Executes `git blame` for a single file and stores the result in memory cache.
   * Overwrites existing cache for this file.
   */
  public async blameFile(filepath: string): Promise<void> {
    try {
      const cwd = path.dirname(filepath);
      const filename = path.basename(filepath);

      const { stdout } = await execAsync(
        `git blame --line-porcelain "${filename}"`,
        { cwd, maxBuffer: 10 * 1024 * 1024 }
      );

      this.cache.clearCache(filepath);
      this.parseBlamePorcelain(filepath, stdout);
    } catch (error) {
      console.error(`Git blame failed for file ${filepath}:`, error);
    }
  }

  /**
   * Gets the line-level diff for a specific commit at a specific line.
   * Uses `git show` to get the full diff, then extracts the relevant hunk.
   */
  public async getLineDiff(
    filepath: string,
    commitHash: string,
    originalLine: number
  ): Promise<LineDiffInfo | null> {
    if (commitHash === '0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const cwd = path.dirname(filepath);
      const filename = path.basename(filepath);

      const { stdout } = await execAsync(
        `git show ${commitHash} --no-color -U3 -- "${filename}"`,
        { cwd, maxBuffer: 5 * 1024 * 1024 }
      );

      return this.extractLineDiffFromShow(stdout, originalLine);
    } catch {
      return null;
    }
  }

  /**
   * Gets the previous commit hash for a given commit (its parent).
   */
  public async getPreviousCommitHash(
    filepath: string,
    commitHash: string
  ): Promise<string | null> {
    if (commitHash === '0000000000000000000000000000000000000000') {
      return null;
    }
    try {
      const cwd = path.dirname(filepath);
      const { stdout } = await execAsync(
        `git rev-parse ${commitHash}~1`,
        { cwd }
      );
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts the relevant diff lines from `git show` output.
   */
  private extractLineDiffFromShow(
    showOutput: string,
    targetLine: number
  ): LineDiffInfo | null {
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

      if (!inDiff) {
        continue;
      }

      if (line.startsWith('-')) {
        // Removed line — could be the "previous" version near our target
        if (
          currentNewLine === targetLine ||
          currentNewLine === targetLine + 1
        ) {
          previous = line.substring(1);
        }
        // Don't increment newLine for removed lines
      } else if (line.startsWith('+')) {
        if (currentNewLine === targetLine) {
          current = line.substring(1);
        }
        currentNewLine++;
      } else {
        // Context line
        currentNewLine++;
      }

      // Early exit if we've found what we need
      if (previous !== null && current !== null) {
        break;
      }
    }

    if (previous === null && current === null) {
      return null;
    }

    return { previous, current };
  }

  /**
   * Parses the porcelain format string into our cache structure
   */
  private parseBlamePorcelain(filepath: string, gitOutput: string) {
    const lines = gitOutput.split('\n');

    let currentCommitInfo: Partial<GitCommitInfo> = {};
    let currentCommitHash = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const matchHeader = line.match(
        /^([a-f0-9]{40})\s+(\d+)\s+(\d+)/
      );
      if (matchHeader) {
        currentCommitHash = matchHeader[1];
        const finalLine = parseInt(matchHeader[3], 10);

        this.cache.setBlameLineInfo(filepath, finalLine, {
          commitHash: currentCommitHash,
          originalLine: parseInt(matchHeader[2], 10),
          finalLine: finalLine,
        });

        if (this.cache.getCommitInfo(currentCommitHash)) {
          continue;
        }
        currentCommitInfo = { hash: currentCommitHash };
        continue;
      }

      if (
        currentCommitHash &&
        !this.cache.getCommitInfo(currentCommitHash)
      ) {
        if (line.startsWith('author ')) {
          currentCommitInfo.authorName = line.substring(7);
        } else if (line.startsWith('author-mail ')) {
          currentCommitInfo.authorEmail = line
            .substring(12)
            .replace(/[<>]/g, '');
        } else if (line.startsWith('author-time ')) {
          currentCommitInfo.date = new Date(
            parseInt(line.substring(12), 10) * 1000
          );
        } else if (line.startsWith('summary ')) {
          currentCommitInfo.summary = line.substring(8);

          if (
            currentCommitInfo.hash &&
            currentCommitInfo.authorName &&
            currentCommitInfo.authorEmail &&
            currentCommitInfo.date &&
            currentCommitInfo.summary
          ) {
            this.cache.setCommitInfo(
              currentCommitHash,
              currentCommitInfo as GitCommitInfo
            );
          }
        }
      }
    }
  }
}

import * as vscode from 'vscode';
import { GitService } from '../../core/gitService';
import { GitCommitInfo } from '../../core/types';
import { timeAgo, formatDate } from '../../utils/dateUtils';
import { getGravatarUrl } from '../../utils/gravatar';

export class LineBlameHoverProvider implements vscode.HoverProvider {
  private gitService: GitService;

  constructor(gitService: GitService) {
    this.gitService = gitService;
  }

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    if (document.uri.scheme !== 'file' || document.isUntitled) {
      return null;
    }

    const filePath = document.uri.fsPath;
    const line = position.line + 1; // 1-indexed for Git

    const cache = this.gitService.getCache();
    if (!cache.hasFileBlame(filePath)) {
      await this.gitService.blameFile(filePath);
    }

    const blameInfo = cache.getBlameLineInfo(filePath, line);
    if (!blameInfo) {
      return null;
    }

    const commitInfo = cache.getCommitInfo(blameInfo.commitHash);
    if (!commitInfo) {
      return null;
    }

    // Get diff lazily only when the hover is actually requested
    const diff = await this.gitService.getLineDiff(
      filePath,
      blameInfo.commitHash,
      blameInfo.originalLine
    );

    const previousHash = await this.gitService.getPreviousCommitHash(
      filePath,
      blameInfo.commitHash
    );

    return this.createRichHover(
      commitInfo,
      blameInfo.commitHash,
      previousHash,
      diff
    );
  }

  private createRichHover(
    commit: GitCommitInfo,
    hash: string,
    previousHash: string | null,
    diff: { previous: string | null; current: string | null } | null
  ): vscode.Hover {
    // --- Uncommitted changes ---
    if (hash === '0000000000000000000000000000000000000000') {
      const md = new vscode.MarkdownString('', true);
      md.isTrusted = true;
      md.supportHtml = true;

      md.appendMarkdown(
        `<img src="${getGravatarUrl('uncommitted@local', 48)}" width="20" height="20" style="border-radius:50%;" /> `
      );
      md.appendMarkdown(
        ` &nbsp;**You** &nbsp;$(clock) _just now_\n\n`
      );
      md.appendMarkdown(
        `$(edit) &nbsp;_Uncommitted changes_\n`
      );
      return new vscode.Hover(md);
    }

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;

    const avatarUrl = getGravatarUrl(commit.authorEmail, 48);
    const shortHash = hash.substring(0, 7);
    const dateStr = formatDate(commit.date);
    const relativeStr = timeAgo(commit.date);

    // ─── Author Name + Date (top) ───
    md.appendMarkdown(
      `**${this.escapeMarkdown(commit.authorName)}** &nbsp;$(clock) ${relativeStr} _(${dateStr})_\n\n`
    );

    // ─── Avatar + Commit message ───
    md.appendMarkdown(
      `<img src="${avatarUrl}" width="40" height="40" style="border-radius:50%;" /> &nbsp;$(git-commit) &nbsp;🔧 <span style="color:#999;">${this.escapeMarkdown(commit.summary)}</span>\n\n`
    );



    // ─── Footer: Changes navigation ───
    md.appendMarkdown(`---\n\n`);

    const footerParts: string[] = [];

    // Commit hash link
    footerParts.push(`$(git-commit) \`${shortHash}\``);

    // Parent hash arrow
    if (previousHash) {
      const prevShort = previousHash.substring(0, 7);
      footerParts.push(
        `$(arrow-left) \`${prevShort}\``
      );
    }

    md.appendMarkdown(
      `Changes &nbsp;${footerParts.join(' &nbsp;$(arrow-swap) &nbsp;')}`
    );

    return new vscode.Hover(md);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
  }
}

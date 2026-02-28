import * as vscode from 'vscode';
import { GitService } from './git-service';
import { timeAgo, formatDate, getGravatarUrl, debounce } from './utils';

export class LineBlameDecorator {
  private decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 3em',
      textDecoration: ';opacity:0.55;font-size:0.9em;',
    },
    isWholeLine: false,
  });
  private activeEditor: vscode.TextEditor | undefined;
  private disposables: vscode.Disposable[] = [];
  private hoverCache = new Map<string, vscode.MarkdownString>();

  constructor(private gitService: GitService) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged.bind(this)),
      vscode.window.onDidChangeTextEditorSelection(debounce(this.updateDecoration.bind(this), 120))
    );
    if (vscode.window.activeTextEditor) {
      this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }
  }

  private async onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
    this.activeEditor = editor;
    if (!editor || editor.document.uri.scheme !== 'file') { return; }
    
    // Asynchronously update blame when editor changes, doesn't block UI
    this.gitService.blameFile(editor.document.uri.fsPath).then(() => {
        if (this.activeEditor === editor) { this.updateDecoration(); }
    });
    this.updateDecoration();
  }

  public async updateDecoration() {
    const editor = this.activeEditor;
    if (!editor || editor.document.uri.scheme !== 'file') { return; }

    const activeLine = editor.selection.active.line;
    const filePath = editor.document.uri.fsPath;
    const blameInfo = this.gitService.getBlameLineInfo(filePath, activeLine + 1);
    const commitInfo = blameInfo ? this.gitService.getCommitInfo(blameInfo.commitHash) : null;

    if (!commitInfo) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const isUncommitted = commitInfo.hash === '0000000000000000000000000000000000000000';
    const summaryText = commitInfo.summary.length > 50 ? commitInfo.summary.substring(0, 47) + '...' : commitInfo.summary;
    const text = isUncommitted ? `  ✏️  Uncommitted changes` : `  ${timeAgo(commitInfo.date)}  •  ${summaryText}`;

    const color = isUncommitted ? '#1DB954' : new vscode.ThemeColor('editorCodeLens.foreground');
    const border = isUncommitted ? 'solid 1px #1DB95420' : 'none';

    let mdBase = this.hoverCache.get(commitInfo.hash);

    if (!mdBase) {
      mdBase = new vscode.MarkdownString('', true);
      mdBase.isTrusted = true;
      mdBase.supportHtml = true;

      if (isUncommitted) {
        mdBase.appendMarkdown(`**You** &nbsp;$(history) _just now_\n\n`);
        mdBase.appendMarkdown(`---\n\n`);
        mdBase.appendMarkdown(`<img src="${getGravatarUrl('uncommitted@local', 28)}" width="24" height="24" style="background-color:transparent;border:0;border-radius:50%;" /> &nbsp;$(edit) &nbsp;<span style="color:#cecece;">Uncommitted changes</span>\n\n`);
      } else {
        const avatarUrl = getGravatarUrl(commitInfo.authorEmail, 48);
        const dateStr = formatDate(commitInfo.date);
        const relativeStr = timeAgo(commitInfo.date);
        const escapeMd = (t: string) => t.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');

        mdBase.appendMarkdown(`**${escapeMd(commitInfo.authorName)}** &nbsp;$(history) _${relativeStr}_ &nbsp;•&nbsp; _${dateStr}_\n\n`);
        mdBase.appendMarkdown(`---\n\n`);
        mdBase.appendMarkdown(`<img src="${avatarUrl}" width="28" height="28" style="background-color:transparent;border:0;border-radius:50%;" /> &nbsp;$(git-commit) &nbsp;<span style="color:#cecece;">${escapeMd(commitInfo.summary)}</span>\n\n`);
        mdBase.appendMarkdown(`---\n\n`);

        const previousHash = await this.gitService.getPreviousCommitHash(filePath, commitInfo.hash);
        const shortHash = commitInfo.hash.substring(0, 7);
        const copyBtn = `[${shortHash} $(copy)](command:git-better.copyHash?%22${commitInfo.hash}%22 "Copy Commit Hash")`;
        
        let changesStr = `**Changes** &nbsp;&nbsp;$(git-commit) ${copyBtn}`;
        if (previousHash) { 
            changesStr += ` &nbsp;$(arrow-swap)&nbsp; \`${previousHash.substring(0, 7)}\``; 
        }
        changesStr += ` &nbsp;|&nbsp; $(github) [Open on GitHub](command:git-better.openGitHub?%22${commitInfo.hash}%22 "Open on GitHub")`;
        
        mdBase.appendMarkdown(changesStr);
      }
      this.hoverCache.set(commitInfo.hash, mdBase);
    }

    // Clone the cached markdown string so we can safely add the line diff
    const finalMd = new vscode.MarkdownString(mdBase.value, true);
    finalMd.isTrusted = true;
    finalMd.supportHtml = true;

    // Append line diff dynamically since diffs are per-line, not per-commit
    if (!isUncommitted && blameInfo) {
      const diff = await this.gitService.getLineDiff(filePath, commitInfo.hash, blameInfo.originalLine);
      if (diff && (diff.previous !== null || diff.current !== null)) {
        finalMd.appendMarkdown(`\n\n\`\`\`diff\n`);
        if (diff.previous !== null) { finalMd.appendMarkdown(`- ${diff.previous}\n`); }
        if (diff.current !== null) { finalMd.appendMarkdown(`+ ${diff.current}\n`); }
        finalMd.appendMarkdown(`\`\`\`\n`);
      }
    }

    // Since we awaited previousHash, ensure cursor hasn't moved.
    if (editor.selection.active.line !== activeLine) { return; }

    const lineEnd = editor.document.lineAt(activeLine).range.end;
    editor.setDecorations(this.decorationType, [{
      range: new vscode.Range(lineEnd, lineEnd),
      hoverMessage: finalMd,
      renderOptions: { 
        after: { 
            contentText: text,
            color: color,
            border: border
        } 
      },
    }]);
  }

  public dispose() {
    this.activeEditor?.setDecorations(this.decorationType, []);
    this.decorationType.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

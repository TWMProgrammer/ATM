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

    let md = this.hoverCache.get(commitInfo.hash);

    if (!md) {
      md = new vscode.MarkdownString('', true);
      md.isTrusted = true;
      md.supportHtml = true;

      if (isUncommitted) {
        md.appendMarkdown(`<img src="${getGravatarUrl('uncommitted@local', 48)}" width="20" height="20" style="border-radius:50%;" />  &nbsp;**You** &nbsp;$(clock) _just now_\n\n$(edit) &nbsp;_Uncommitted changes_\n`);
      } else {
        const avatarUrl = getGravatarUrl(commitInfo.authorEmail, 48);
        const dateStr = formatDate(commitInfo.date);
        const relativeStr = timeAgo(commitInfo.date);
        const escapeMd = (t: string) => t.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');

        md.appendMarkdown(`**${escapeMd(commitInfo.authorName)}** &nbsp;$(clock) ${relativeStr} _(${dateStr})_\n\n`);
        md.appendMarkdown(`<img src="${avatarUrl}" width="40" height="40" style="border-radius:50%;" /> &nbsp;$(git-commit) &nbsp;🔧 <span style="color:#999;">${escapeMd(commitInfo.summary)}</span>\n\n`);
        md.appendMarkdown(`---\n\n`);

        const previousHash = await this.gitService.getPreviousCommitHash(filePath, commitInfo.hash);
        const footerParts = [`$(git-commit) \`${commitInfo.hash.substring(0, 7)}\``];
        if (previousHash) { footerParts.push(`$(arrow-left) \`${previousHash.substring(0, 7)}\``); }
        md.appendMarkdown(`Changes &nbsp;${footerParts.join(' &nbsp;$(arrow-swap) &nbsp;')}`);
      }
      this.hoverCache.set(commitInfo.hash, md);
    }

    // Since we awaited previousHash, ensure cursor hasn't moved.
    if (editor.selection.active.line !== activeLine) { return; }

    const lineEnd = editor.document.lineAt(activeLine).range.end;
    editor.setDecorations(this.decorationType, [{
      range: new vscode.Range(lineEnd, lineEnd),
      hoverMessage: md,
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

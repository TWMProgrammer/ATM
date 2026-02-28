import * as vscode from 'vscode';
import { GitService } from './git-service';
import { timeAgo, formatDate, getGravatarUrl, debounce } from './utils';

export class LineBlameDecorator {
  private decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      margin: '0 0 0 3em',
      textDecoration: ';opacity:0.6;font-size:0.9em',
    },
    isWholeLine: false,
  });
  private activeEditor: vscode.TextEditor | undefined;
  private disposables: vscode.Disposable[] = [];

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

  public updateDecoration() {
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
    const author = isUncommitted || commitInfo.authorName === 'Not Committed Yet' ? 'You' : commitInfo.authorName;
    const suffix = isUncommitted ? 'Uncommitted changes' : `${commitInfo.hash.substring(0, 7)}  •  ${commitInfo.summary.length > 50 ? commitInfo.summary.substring(0, 47) + '...' : commitInfo.summary}`;
    const text = isUncommitted ? `  ✏️  ${suffix}` : `  ${author}, ${timeAgo(commitInfo.date)}  •  ${suffix}`;

    const lineEnd = editor.document.lineAt(activeLine).range.end;
    editor.setDecorations(this.decorationType, [{
      range: new vscode.Range(lineEnd, lineEnd),
      renderOptions: { after: { contentText: text } },
    }]);
  }

  public dispose() {
    this.activeEditor?.setDecorations(this.decorationType, []);
    this.decorationType.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

export class LineBlameHoverProvider implements vscode.HoverProvider {
  constructor(private gitService: GitService) {}

  public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
    if (document.uri.scheme !== 'file' || document.isUntitled) { return null; }

    const filePath = document.uri.fsPath;
    const line = position.line + 1;
    
    // Ensure we have blame info (in case hovered before changed)
    if (!this.gitService.hasFileBlame(filePath)) {
        await this.gitService.blameFile(filePath);
    }

    const blameInfo = this.gitService.getBlameLineInfo(filePath, line);
    const commit = blameInfo ? this.gitService.getCommitInfo(blameInfo.commitHash) : null;
    if (!blameInfo || !commit) { return null; }

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;

    if (commit.hash === '0000000000000000000000000000000000000000') {
      md.appendMarkdown(`<img src="${getGravatarUrl('uncommitted@local', 48)}" width="20" height="20" style="border-radius:50%;" />  &nbsp;**You** &nbsp;$(clock) _just now_\n\n$(edit) &nbsp;_Uncommitted changes_\n`);
      return new vscode.Hover(md);
    }

    const previousHash = await this.gitService.getPreviousCommitHash(filePath, commit.hash);
    const avatarUrl = getGravatarUrl(commit.authorEmail, 48);
    const dateStr = formatDate(commit.date);
    const relativeStr = timeAgo(commit.date);
    const escapeMd = (t: string) => t.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');

    md.appendMarkdown(`**${escapeMd(commit.authorName)}** &nbsp;$(clock) ${relativeStr} _(${dateStr})_\n\n`);
    md.appendMarkdown(`<img src="${avatarUrl}" width="40" height="40" style="border-radius:50%;" /> &nbsp;$(git-commit) &nbsp;🔧 <span style="color:#999;">${escapeMd(commit.summary)}</span>\n\n`);
    md.appendMarkdown(`---\n\n`);

    const footerParts = [`$(git-commit) \`${commit.hash.substring(0, 7)}\``];
    if (previousHash) { footerParts.push(`$(arrow-left) \`${previousHash.substring(0, 7)}\``); }
    md.appendMarkdown(`Changes &nbsp;${footerParts.join(' &nbsp;$(arrow-swap) &nbsp;')}`);

    return new vscode.Hover(md);
  }
}

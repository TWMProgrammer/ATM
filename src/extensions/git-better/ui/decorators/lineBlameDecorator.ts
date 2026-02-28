import * as vscode from 'vscode';
import { GitService } from '../../core/gitService';
import { timeAgo } from '../../utils/dateUtils';
import { debounce } from '../../utils/debounce';

export class LineBlameDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private gitService: GitService;
  private disposables: vscode.Disposable[] = [];
  private activeEditor: vscode.TextEditor | undefined;

  constructor(gitService: GitService) {
    this.gitService = gitService;

    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 3em',
        textDecoration: ';opacity:0.6;font-size:0.9em',
      },
      isWholeLine: false,
    });

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(
        this.onActiveEditorChanged.bind(this)
      ),
      vscode.window.onDidChangeTextEditorSelection(
        debounce(this.onSelectionChanged.bind(this), 120)
      ),
      vscode.workspace.onDidChangeTextDocument(
        debounce(this.onDocumentChanged.bind(this), 500)
      )
    );

    if (vscode.window.activeTextEditor) {
      this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }
  }

  private async onActiveEditorChanged(
    editor: vscode.TextEditor | undefined
  ) {
    this.activeEditor = editor;
    if (!editor || !this.isValidDocument(editor.document)) {
      return;
    }

    const filePath = editor.document.uri.fsPath;
    if (!this.gitService.getCache().hasFileBlame(filePath)) {
      await this.gitService.blameFile(filePath);
    }

    this.updateDecoration(editor);
  }

  private onSelectionChanged(
    event: vscode.TextEditorSelectionChangeEvent
  ) {
    if (event.textEditor === this.activeEditor) {
      this.updateDecoration(event.textEditor);
    }
  }

  private async onDocumentChanged(
    event: vscode.TextDocumentChangeEvent
  ) {
    // When the document is modified, invalidate cache for that file
    if (
      this.activeEditor &&
      event.document === this.activeEditor.document &&
      this.isValidDocument(event.document)
    ) {
      const filePath = event.document.uri.fsPath;
      this.gitService.getCache().clearCache(filePath);
    }
  }

  private updateDecoration(editor: vscode.TextEditor) {
    if (!editor || !this.isValidDocument(editor.document)) {
      return;
    }

    const activeLine = editor.selection.active.line;
    const filePath = editor.document.uri.fsPath;

    const blameInfo = this.gitService
      .getCache()
      .getBlameLineInfo(filePath, activeLine + 1);

    if (!blameInfo) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const commitInfo = this.gitService
      .getCache()
      .getCommitInfo(blameInfo.commitHash);

    if (!commitInfo) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    let blameText = '';
    if (
      commitInfo.hash ===
      '0000000000000000000000000000000000000000'
    ) {
      blameText = '  ✏️  Uncommitted changes';
    } else {
      const author =
        commitInfo.authorName === 'Not Committed Yet'
          ? 'You'
          : commitInfo.authorName;
      const shortHash = commitInfo.hash.substring(0, 7);
      const summary =
        commitInfo.summary.length > 50
          ? commitInfo.summary.substring(0, 47) + '...'
          : commitInfo.summary;

      blameText = `  ${author}, ${timeAgo(commitInfo.date)}  •  ${shortHash}  •  ${summary}`;
    }

    const endPos = editor.document.lineAt(activeLine).range.end;
    const range = new vscode.Range(endPos, endPos);

    const decoration: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: blameText,
        },
      },
    };

    editor.setDecorations(this.decorationType, [decoration]);
  }

  private isValidDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' && !document.isUntitled;
  }

  public dispose() {
    this.activeEditor?.setDecorations(this.decorationType, []);
    this.decorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

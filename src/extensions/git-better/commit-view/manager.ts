import * as vscode from 'vscode';
import { GitService } from './git-service';
import { LineBlameDecorator } from './blame-ui';
import { debounce } from './utils';

export class GitBetterManager {
    private gitService = new GitService();
    private blameDecorator = new LineBlameDecorator(this.gitService);
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.disposables.push(
            // Re-fetch async when document changes, without clearing cache immediately
            vscode.workspace.onDidChangeTextDocument(debounce((event: vscode.TextDocumentChangeEvent) => {
                if (event.document.uri.scheme === 'file') {
                    this.gitService.blameFile(event.document.uri.fsPath).then(() => {
                        this.blameDecorator.updateDecoration();
                    });
                }
            }, 1000))
        );
    }

    public dispose() {
        this.blameDecorator.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}

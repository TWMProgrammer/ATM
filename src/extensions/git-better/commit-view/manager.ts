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
            vscode.commands.registerCommand('git-better.copyHash', (hash: string) => {
                if (hash) {
                    vscode.env.clipboard.writeText(hash);
                    vscode.window.setStatusBarMessage(`Commit ${hash.substring(0, 7)} copied to clipboard!`, 3000);
                }
            }),
            vscode.commands.registerCommand('git-better.openGitHub', async (hash: string) => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !hash) { return; }
                const filePath = editor.document.uri.fsPath;
                const url = await this.gitService.getCommitUrl(filePath, hash);
                
                if (url) {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                } else {
                    vscode.window.showErrorMessage('Could not determine GitHub URL for this repository.');
                }
            }),
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

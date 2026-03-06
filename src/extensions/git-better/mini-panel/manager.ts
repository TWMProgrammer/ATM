import * as vscode from 'vscode';
import { GitService } from './git-service';
import { LineBlameDecorator } from './blame-ui';
import { debounce } from './utils';

export class GitBetterManager implements vscode.Disposable {
    private gitService = new GitService();
    private blameDecorator = new LineBlameDecorator(this.gitService);
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        // Debounce fetching to avoid spawning too many git processes on rapid typing
        const debouncedReFetch = debounce((document: vscode.TextDocument) => {
            this.gitService.invalidateFile(document.uri.fsPath);
            this.gitService.blameFile(document.uri.fsPath, document.getText()).then(() => {
                this.blameDecorator.updateDecoration();
            });
        }, 500);

        this.disposables.push(
            // --- Commands ---
            vscode.commands.registerCommand('git-better.copyHash', (hash: string) => {
                if (hash) {
                    vscode.env.clipboard.writeText(hash);
                    vscode.window.setStatusBarMessage(
                        `$(check) Commit ${hash.substring(0, 7)} copied!`,
                        3000
                    );
                    this.blameDecorator.setCopiedHash(hash);
                }
            }),

            vscode.commands.registerCommand('git-better.openGitHub', async (hash: string) => {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !hash) { return; }
                const filePath = editor.document.uri.fsPath;
                const url = await this.gitService.getCommitUrl(filePath, hash);

                if (url) {
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                } else {
                    vscode.window.showErrorMessage(
                        'Could not determine GitHub URL for this repository.'
                    );
                }
            }),

            vscode.commands.registerCommand('git-better.toggleBlame', () => {
                const enabled = this.blameDecorator.toggleEnabled();
                vscode.window.setStatusBarMessage(
                    `$(git-commit) Inline blame ${enabled ? 'enabled' : 'disabled'}`,
                    3000
                );
            }),

            // --- File events ---

            // Re-fetch blame after document content changes (typing)
            vscode.workspace.onDidChangeTextDocument((event) => {
                const activeEditor = vscode.window.activeTextEditor;
                // Only process if it's the active document and there are actual changes
                if (activeEditor && event.document === activeEditor.document && event.contentChanges.length > 0) {
                    if (event.document.uri.scheme === 'file') {
                        debouncedReFetch(event.document);
                    }
                }
            }),

            // Invalidate cache & re-blame on save (the persisted content may differ slightly)
            vscode.workspace.onDidSaveTextDocument((document) => {
                const activeEditor = vscode.window.activeTextEditor;
                if (document.uri.scheme === 'file' && activeEditor && document === activeEditor.document) {
                    this.gitService.invalidateFile(document.uri.fsPath);
                    this.blameDecorator.invalidateHoverCache();
                    this.gitService.blameFile(document.uri.fsPath, document.getText()).then(() => {
                        this.blameDecorator.updateDecoration();
                    });
                }
            }),

            // Clean up debounce timer
            { dispose: debouncedReFetch.cancel },
        );
    }

    public dispose() {
        this.blameDecorator.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}

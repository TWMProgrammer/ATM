import * as vscode from 'vscode';
import { GitService } from './core/gitService';
import { LineBlameDecorator } from './ui/decorators/lineBlameDecorator';
import { LineBlameHoverProvider } from './ui/hovers/lineBlameHover';

export class GitBetterManager {
    private gitService: GitService;
    private blameDecorator: LineBlameDecorator;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        // Core Git Operations
        this.gitService = new GitService();

        // UI Modules
        this.blameDecorator = new LineBlameDecorator(this.gitService);

        // Register Hover Provider
        this.disposables.push(
            vscode.languages.registerHoverProvider(
                { scheme: 'file' },
                new LineBlameHoverProvider(this.gitService)
            )
        );

        // Optionally, register file save event to update cache in real-time
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (document.uri.scheme === 'file') {
                    // Update blame asynchronously
                    this.gitService.blameFile(document.uri.fsPath);
                }
            })
        );
    }

    public dispose() {
        this.blameDecorator.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}

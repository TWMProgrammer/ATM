import * as vscode from 'vscode';

/**
 * Routes and handles all messages received from the graph-panel webview.
 * Each message `type` maps to a handler method.
 */
export class Messaging {

    /** Bind this handler to a webview instance. */
    public attach(webview: vscode.Webview): vscode.Disposable {
        return webview.onDidReceiveMessage((msg) => this.route(msg));
    }

    // ── Router ──────────────────────────────────────────

    private route(message: { type: string; [key: string]: unknown }) {
        switch (message.type) {
            case 'toggleExpand':
                this.handleToggleExpand();
                break;
            case 'copyCommit':
                this.handleCopyCommit(message as any);
                break;
            case 'openCommitOnGithub':
                this.handleOpenGithub(message as any);
                break;
            // Add future message types here
        }
    }

    // ── Handlers ────────────────────────────────────────

    /** Maximize or restore the VS Code bottom panel. */
    private handleToggleExpand() {
        vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
    }

    /** Copy the current commit hash to the clipboard. */
    private handleCopyCommit(message: { hash: string }) {
        if (!message.hash) {
            return;
        }
        vscode.env.clipboard.writeText(message.hash);
        vscode.window.showInformationMessage(`Copied commit hash: ${message.hash}`);
    }

    /** Open the provided GitHub URL in the default browser. */
    private handleOpenGithub(message: { url: string }) {
        if (!message.url) {
            vscode.window.showInformationMessage('No GitHub origin found for this repository.');
            return;
        }
        vscode.env.openExternal(vscode.Uri.parse(message.url));
    }
}

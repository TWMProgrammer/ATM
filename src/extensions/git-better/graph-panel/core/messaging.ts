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
            case 'explainCommit':
                this.handleExplainCommit(message as any);
                break;
            // Add future message types here
        }
    }

    // ── Handlers ────────────────────────────────────────

    /** Maximize or restore the VS Code bottom panel. */
    private handleToggleExpand() {
        vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
    }

    /** Trigger the AI Explain feature for a specific commit. */
    private handleExplainCommit(message: { hash: string }) {
        if (!message.hash) {
            return;
        }
        vscode.window.showInformationMessage(`AI Explain requested for commit: ${message.hash}`);
        // TODO: Bridge this to the Actual AI Provider logic
    }
}

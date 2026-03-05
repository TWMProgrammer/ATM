import * as vscode from 'vscode';
import { TemplateBuilder } from './template';
import { Messaging } from './messaging';
import { GraphGitService } from './git-service';

/**
 * WebviewViewProvider for the Git Graph Panel.
 *
 * Thin coordinator that wires up the webview and delegates:
 *  - HTML generation  → TemplateBuilder
 *  - Message routing  → Messaging
 */
export class GraphPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitlab.graphView';

    private readonly template: TemplateBuilder;
    private readonly messaging: Messaging;

    constructor(private readonly extensionUri: vscode.Uri) {
        this.template = new TemplateBuilder(extensionUri);
        this.messaging = new Messaging();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.template.build(webviewView.webview);

        const msgDisposable = this.messaging.attach(webviewView.webview);
        const readyDisposable = webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'ready') {
                this.sendInitialData(webviewView.webview);
            }
        });

        webviewView.onDidDispose(() => {
            msgDisposable.dispose();
            readyDisposable.dispose();
        });
    }

    private async sendInitialData(webview: vscode.Webview) {
        const latestCommit = await GraphGitService.getLatestCommit();
        if (latestCommit) {
            webview.postMessage({
                type: 'renderCommit',
                data: latestCommit
            });
        }
    }
}

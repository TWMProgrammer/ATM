import * as vscode from 'vscode';
import { TemplateBuilder } from './template';
import { Messaging } from './messaging';

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
        this.messaging.attach(webviewView.webview);
    }
}

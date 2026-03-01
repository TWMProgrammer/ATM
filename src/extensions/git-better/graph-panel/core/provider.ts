import * as vscode from 'vscode';
import * as fs from 'fs';

export class GraphPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitlab.graphView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const uiPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui');
        const htmlPath = vscode.Uri.joinPath(uiPath, 'index.html').fsPath;
        const uiUri = webview.asWebviewUri(uiPath);
        const assetsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'assets'));

        let htmlContent = '';
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf8');
        } catch (e) {
            return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body><h1>Error loading HTML</h1></body></html>`;
        }

        const nonce = this.getNonce();

        // Replace relative asset paths with correct webview URIs
        htmlContent = htmlContent.replace(/\.\.\/assets\//g, `${assetsUri}/`);

        // Replace styles paths with correct webview URIs dynamically
        htmlContent = htmlContent.replace(/href="\.\/styles\/(.+?\.css)"/g, `href="${uiUri}/styles/$1"`);
        
        // Dynamically inject the workspace name
        const workspaceName = vscode.workspace.name || 'Unknown Repository';
        htmlContent = htmlContent.replace(/<span class="repo-name">.*?<\/span>/, `<span class="repo-name">${workspaceName}</span>`);
        
        // Setup Content Security Policy
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} https: data:;">`;
        htmlContent = htmlContent.replace('<head>', `<head>\n    ${csp}`);

        return htmlContent;
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

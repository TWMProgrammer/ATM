import * as vscode from 'vscode';
import * as fs from 'fs';

// ── Nonce Generator ─────────────────────────────────────

/** Generates a random nonce string for CSP script whitelisting. */
function generateNonce(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < length; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

// ── HTML Template Builder ───────────────────────────────

/**
 * Builds the final HTML for the graph-panel webview.
 *
 * Reads the raw template from disk and applies all transformations:
 * asset URIs, style URIs, workspace name, nonce, and CSP injection.
 */
export class TemplateBuilder {

    constructor(private readonly extensionUri: vscode.Uri) { }

    /** Returns ready-to-render HTML for the given webview. */
    public build(webview: vscode.Webview): string {
        const uiPath = vscode.Uri.joinPath(
            this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui',
        );
        const htmlPath = vscode.Uri.joinPath(uiPath, 'index.html').fsPath;
        const uiUri = webview.asWebviewUri(uiPath);
        const assetsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'assets',
            ),
        );

        let html = this.readTemplate(htmlPath);
        if (!html) { return this.errorPage(); }

        const nonce = generateNonce();

        html = this.replaceAssetPaths(html, assetsUri);
        html = this.replaceStylePaths(html, uiUri);
        html = this.injectWorkspaceName(html);
        html = this.injectNonce(html, nonce);
        html = this.injectCsp(html, webview, nonce);

        return html;
    }

    // ── Private Helpers ─────────────────────────────────

    private readTemplate(path: string): string | null {
        try { return fs.readFileSync(path, 'utf8'); }
        catch { return null; }
    }

    private replaceAssetPaths(html: string, assetsUri: vscode.Uri): string {
        return html.replace(/\.\.\/assets\//g, `${assetsUri}/`);
    }

    private replaceStylePaths(html: string, uiUri: vscode.Uri): string {
        return html.replace(/href="\.\/styles\/(.+?\.css)"/g, `href="${uiUri}/styles/$1"`);
    }

    private injectWorkspaceName(html: string): string {
        const name = vscode.workspace.name || 'Unknown Repository';
        return html.replace(/<span class="repo-name">.*?<\/span>/, `<span class="repo-name">${name}</span>`);
    }

    /** Replace every {{NONCE}} placeholder with the real nonce value. */
    private injectNonce(html: string, nonce: string): string {
        return html.replace(/\{\{NONCE\}\}/g, nonce);
    }

    private injectCsp(html: string, webview: vscode.Webview, nonce: string): string {
        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource} https: data:`,
            `style-src ${webview.cspSource} 'unsafe-inline' https:`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource} https: data:`,
        ].join('; ');

        const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
        return html.replace('<head>', `<head>\n    ${meta}`);
    }

    private errorPage(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body><h1>Error loading Graph Panel HTML</h1></body>
</html>`;
    }
}

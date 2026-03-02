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
 * Performance optimizations:
 *  1. Caches the raw HTML template after first read (avoids repeated disk I/O)
 *  2. Pre-computes static URI paths once per webview
 *  3. Uses a single-pass replacement for all placeholders
 */
export class TemplateBuilder {

    /** Cached raw HTML from disk — read once, reused on every resolve. */
    private templateCache: string | null = null;

    constructor(private readonly extensionUri: vscode.Uri) { }

    /** Returns ready-to-render HTML for the given webview. */
    public build(webview: vscode.Webview): string {
        const template = this.getTemplate();
        if (!template) { return this.errorPage(); }

        // Pre-compute all dynamic values once
        const uiPath = vscode.Uri.joinPath(
            this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui',
        );
        const uiUri = webview.asWebviewUri(uiPath);
        const assetsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'assets',
            ),
        );

        const nonce = generateNonce();
        const workspaceName = vscode.workspace.name || 'Unknown Repository';

        // CSP meta tag
        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource} https: data:`,
            `style-src ${webview.cspSource} 'unsafe-inline' https:`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource} https: data:`,
        ].join('; ');
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

        // Single-pass replacement using a lookup map — no chained pattern matching
        const replacements: Record<string, string> = {
            '{{NONCE}}': nonce,
            '{{CSP}}': cspMeta,
            '{{ASSETS_URI}}': assetsUri.toString(),
            '{{UI_URI}}': uiUri.toString(),
            '{{SCRIPTS_URI}}': webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist')).toString(),
            '{{WORKSPACE_NAME}}': workspaceName,
        };

        const pattern = /\{\{(?:NONCE|CSP|ASSETS_URI|UI_URI|SCRIPTS_URI|WORKSPACE_NAME)\}\}/g;
        return template.replace(pattern, (match) => replacements[match]);
    }

    /** Invalidate the cache if the HTML file is changed during development. */
    public invalidateCache() {
        this.templateCache = null;
    }

    // ── Private Helpers ─────────────────────────────────

    /** Reads and caches the raw HTML template from disk. */
    private getTemplate(): string | null {
        if (this.templateCache !== null) {
            return this.templateCache;
        }

        const htmlPath = vscode.Uri.joinPath(
            this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui', 'index.html',
        ).fsPath;

        try {
            this.templateCache = fs.readFileSync(htmlPath, 'utf8');
            return this.templateCache;
        } catch {
            return null;
        }
    }

    private errorPage(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body><h1>Error loading Graph Panel HTML</h1></body>
</html>`;
    }
}

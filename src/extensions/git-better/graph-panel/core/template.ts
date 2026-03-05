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

    /** Cached raw HTML from disk — read once per file, reused. */
    private templateCache = new Map<string, string>();

    constructor(private readonly extensionUri: vscode.Uri) { }

    /** Returns ready-to-render HTML for the given webview. */
    public build(webview: vscode.Webview): string {
        const template = this.getTemplate('index.html');
        if (!template) { return this.errorPage(); }

        // Load sub-components
        const toolbarHtml = this.getTemplate('templates/toolbar.html') || '';
        const sidebarHtml = this.getTemplate('templates/sidebar.html') || '';
        const inspectHtml = this.getTemplate('templates/inspect.html') || '';
        const tableHtml = this.getTemplate('templates/table.html') || '';
        const graphHtml = this.getTemplate('templates/graph.html') || '';

        // Assemble the complete HTML first
        let fullHtml = template
            .replace('{{TOOLBAR_COMPONENT}}', toolbarHtml)
            .replace('{{SIDEBAR_COMPONENT}}', sidebarHtml)
            .replace('{{INSPECT_COMPONENT}}', inspectHtml)
            .replace('{{TABLE_COMPONENT}}', tableHtml)
            .replace('{{GRAPH_COMPONENT}}', graphHtml);

        // Pre-compute dynamic values
        const nonce = generateNonce();
        const workspaceName = vscode.workspace.name || 'Unknown Repository';
        const assetsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'assets')
        ).toString();
        const uiUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui')
        ).toString();
        const scriptsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist')
        ).toString();

        // CSP meta tag
        const csp = [
            `default-src 'none'`,
            `img-src ${webview.cspSource} https: data:`,
            `style-src ${webview.cspSource} 'unsafe-inline' https:`,
            `script-src 'nonce-${nonce}'`,
            `font-src ${webview.cspSource} https: data:`,
            `connect-src https:`,
        ].join('; ');

        // Universal replacements map
        const replacements: Record<string, string> = {
            'CSP': `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
            'NONCE': nonce,
            'ASSETS_URI': assetsUri,
            'UI_URI': uiUri,
            'SCRIPTS_URI': scriptsUri,
            'WORKSPACE_NAME': workspaceName
        };

        // Replace all {{KEY}} tags in the assembled HTML
        return fullHtml.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
            return replacements[key] || match;
        });
    }

    /** Invalidate the cache if the HTML file is changed during development. */
    public invalidateCache() {
        this.templateCache.clear();
    }

    // ── Private Helpers ─────────────────────────────────

    /** Reads and caches the raw HTML template from disk. */
    private getTemplate(fileName: string): string | null {
        if (this.templateCache.has(fileName)) {
            return this.templateCache.get(fileName)!;
        }

        const htmlPath = vscode.Uri.joinPath(
            this.extensionUri, 'src', 'extensions', 'git-better', 'graph-panel', 'ui', fileName,
        ).fsPath;

        try {
            const content = fs.readFileSync(htmlPath, 'utf8');
            this.templateCache.set(fileName, content);
            return content;
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

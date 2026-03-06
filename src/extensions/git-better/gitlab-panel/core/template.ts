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
 * Builds the final HTML for the gitlab-panel webview.
 *
 * Performance optimizations:
 *  1. Caches the raw HTML template after first read (avoids repeated disk I/O)
 *  2. Pre-computes static URI paths once per webview
 *  3. Uses a single-pass replacement for all placeholders
 */
export class TemplateBuilder {

    /** Cached raw HTML from disk — read once per file, reused. */
    private templateCache = new Map<string, string>();

    /** Base path to the gitlab-panel directory. */
    private readonly panelBase: string[];

    constructor(private readonly extensionUri: vscode.Uri) {
        this.panelBase = ['src', 'extensions', 'git-better', 'gitlab-panel'];
    }

    /** Returns ready-to-render HTML for the given webview. */
    public build(webview: vscode.Webview): string {
        const template = this.getTemplate('index.html');
        if (!template) { return this.errorPage(); }

        // Load sub-components from panels/
        const toolbarHtml = this.getTemplate('panels/toolbar/toolbar.html') || '';
        const minimapHtml = this.getTemplate('panels/minimap/minimap.html') || '';
        const sidebarHtml = this.getTemplate('panels/sidebar/sidebar.html') || '';
        const tableHtml = this.getTemplate('panels/table/table.html') || '';
        const inspectHtml = this.getTemplate('panels/inspect/inspect.html') || '';

        // Assemble the complete HTML
        let fullHtml = template
            .replace('{{TOOLBAR_COMPONENT}}', toolbarHtml)
            .replace('{{MINIMAP_COMPONENT}}', minimapHtml)
            .replace('{{SIDEBAR_COMPONENT}}', sidebarHtml)
            .replace('{{TABLE_COMPONENT}}', tableHtml)
            .replace('{{INSPECT_COMPONENT}}', inspectHtml);

        // Pre-compute dynamic values
        const nonce = generateNonce();
        const workspaceName = vscode.workspace.name || 'Unknown Repository';

        // Assets are now at git-better/assets (shared with commit-view)
        const assetsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'src', 'extensions', 'git-better', 'assets')
        ).toString();

        // Shared styles at gitlab-panel/shared/
        const sharedUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, ...this.panelBase, 'shared')
        ).toString();

        // Panel styles at gitlab-panel/panels/
        const panelsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, ...this.panelBase, 'panels')
        ).toString();

        // Compiled scripts at dist/
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
            'SHARED_URI': sharedUri,
            'PANELS_URI': panelsUri,
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
    private getTemplate(relativePath: string): string | null {
        if (this.templateCache.has(relativePath)) {
            return this.templateCache.get(relativePath)!;
        }

        const htmlPath = vscode.Uri.joinPath(
            this.extensionUri, ...this.panelBase, relativePath,
        ).fsPath;

        try {
            const content = fs.readFileSync(htmlPath, 'utf8');
            this.templateCache.set(relativePath, content);
            return content;
        } catch {
            return null;
        }
    }

    private errorPage(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body><h1>Error loading GitLab Panel HTML</h1></body>
</html>`;
    }
}

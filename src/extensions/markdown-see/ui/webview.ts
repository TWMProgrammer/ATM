import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

export class TranslatorWebviewPanel {
    public static currentPanel: TranslatorWebviewPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _md: MarkdownIt;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._md = new MarkdownIt();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TranslatorWebviewPanel.currentPanel) {
            TranslatorWebviewPanel.currentPanel._panel.reveal(column);
            return TranslatorWebviewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'markdownSeeWebview',
            'Translated Extension',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'assets')]
            }
        );

        TranslatorWebviewPanel.currentPanel = new TranslatorWebviewPanel(panel, extensionUri);
        return TranslatorWebviewPanel.currentPanel;
    }

    public setSkeleton() {
        this._panel.webview.html = this.getHtmlForWebview(true, "");
    }

    public setTranslatedMarkdown(markdown: string) {
        const renderedHtml = this._md.render(markdown);
        this._panel.webview.html = this.getHtmlForWebview(false, renderedHtml);
    }

    public setError(errorMessage: string) {
        this._panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <body>
                <h2>Error</h2>
                <p style="color: red;">\${errorMessage}</p>
            </body>
            </html>
        `;
    }

    private getHtmlForWebview(isLoading: boolean, content: string): string {
        const skeletonHtml = `
            <div class="skeleton-container">
                <div class="skeleton-title"></div>
                <div class="skeleton-line" style="width: 80%;"></div>
                <div class="skeleton-line" style="width: 90%;"></div>
                <div class="skeleton-line" style="width: 70%;"></div>
                <div class="skeleton-box"></div>
                <div class="skeleton-line" style="width: 85%;"></div>
                <div class="skeleton-line" style="width: 60%;"></div>
            </div>
        `;

        const style = `
            <style>
                body {
                    font-family: var(--vscode-editor-font-family);
                    padding: 20px;
                    line-height: 1.6;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .skeleton-container {
                    animation: fade-in 0.5s ease-in;
                }
                .skeleton-title {
                    height: 32px;
                    width: 40%;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    margin-bottom: 24px;
                    border-radius: 4px;
                    animation: pulse 1.5s infinite;
                }
                .skeleton-line {
                    height: 16px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    margin-bottom: 12px;
                    border-radius: 4px;
                    animation: pulse 1.5s infinite;
                }
                .skeleton-box {
                    height: 150px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    margin: 24px 0;
                    border-radius: 4px;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                    100% { opacity: 0.5; }
                }

                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .content {
                    animation: fade-in 0.8s ease-out forwards;
                    opacity: 0;
                }

                /* Basic markdown styles */
                h1, h2, h3 { color: var(--vscode-editor-foreground); margin-top: 1.5em; }
                a { color: var(--vscode-textLink-foreground); text-decoration: none; }
                a:hover { text-decoration: underline; }
                code {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                }
                pre {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 16px;
                    border-radius: 6px;
                    overflow: auto;
                }
                blockquote {
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding-left: 1em;
                    margin-left: 0;
                    color: var(--vscode-textBlockQuote-foreground);
                }
                img { max-width: 100%; border-radius: 6px; }
            </style>
        `;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Translated View</title>
                ${style}
            </head>
            <body>
                ${isLoading ? skeletonHtml : `<div class="content">${content}</div>`}
            </body>
            </html>
        `;
    }

    public dispose() {
        TranslatorWebviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

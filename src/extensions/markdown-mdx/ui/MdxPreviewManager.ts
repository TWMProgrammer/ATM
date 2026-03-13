import * as vscode from 'vscode';
import { MdxCompiler } from '../core/MdxCompiler';

export class MdxPreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentDocumentUri: vscode.Uri | undefined;
  private readonly updateDebounceMs = 300;
  private updateTimeout: NodeJS.Timeout | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  private createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  }

  public showPreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active MDX document to preview.');
      return;
    }

    if (editor.document.languageId !== 'mdx') {
      vscode.window.showErrorMessage('Active document is not an MDX file.');
      return;
    }

    this.currentDocumentUri = editor.document.uri;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.updatePreview(editor.document.getText());
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'mdxPreview',
        'MDX Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri]
        }
      );

      this.panel.iconPath = vscode.Uri.joinPath(
        this.extensionUri,
        'src',
        'extensions',
        'markdown-mdx',
        'assets',
        'file-icon.svg'
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
          this.updateTimeout = undefined;
        }
        this.currentDocumentUri = undefined;
      }, null, this.disposables);

      this.panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'ready') {
          /* =========================================================
           * 🚀 INITIAL PREVIEW
           * Send once webview scripts (React) have loaded
           * ========================================================= */
          if (this.currentDocumentUri) {
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.currentDocumentUri?.toString());
            if (doc) {
              this.updatePreview(doc.getText());
            }
          }
        }
      }, null, this.disposables);

      /* =========================================================
       * 🔄 TEXT CHANGES LISTENER
       * Live-update the preview
       * ========================================================= */
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === this.currentDocumentUri?.toString()) {
          this.queueUpdate(e.document.getText());
        }
      }, null, this.disposables);
      
      /* =========================================================
       * 👁️ ACTIVE EDITOR CHANGES LISTENER
       * Switch preview document
       * ========================================================= */
      vscode.window.onDidChangeActiveTextEditor((e) => {
        if (e && e.document.languageId === 'mdx') {
          this.currentDocumentUri = e.document.uri;
          this.queueUpdate(e.document.getText());
        }
      }, null, this.disposables);

      /* =========================================================
       * 🌐 SETUP WEBVIEW
       * ========================================================= */
      this.setupWebviewHtml();
    }
  }

  private queueUpdate(text: string) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => {
      this.updatePreview(text);
    }, this.updateDebounceMs);
  }

  private setupWebviewHtml() {
    if (!this.panel) {
        return;
    }

    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'mdxPreviewWebview.js')
    );
    const nonce = this.createNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${this.panel.webview.cspSource} https: data:`,
      `style-src ${this.panel.webview.cspSource} 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}' 'unsafe-eval'`,
      `font-src ${this.panel.webview.cspSource}`
    ].join('; ');

    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>MDX Preview</title>
  <style nonce="${nonce}">
    body {
      padding: 20px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      line-height: 1.6;
    }
    h1, h2, h3, h4, h5, h6 {
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 0.3em;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }
    pre code {
      display: block;
      padding: 1em;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid var(--vscode-textBlockQuote-border);
      padding: 0 1em;
      color: var(--vscode-textBlockQuote-foreground);
      margin: 0;
    }
    a {
      color: var(--vscode-textLink-foreground);
    }
    a:hover {
      color: var(--vscode-textLink-activeForeground);
    }
    #error-overlay {
      color: var(--vscode-errorForeground);
      font-family: monospace;
      white-space: pre-wrap;
      display: none;
    }
    table {
      border-collapse: collapse;
      margin: 1em 0;
      width: 100%;
      overflow: auto;
    }
    table th, table td {
      border: 1px solid var(--vscode-textBlockQuote-border);
      padding: 0.5em 1em;
      text-align: left;
    }
    table th {
      background-color: var(--vscode-textBlockQuote-background);
      font-weight: bold;
    }
    table tr:nth-child(2n) {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
    }
  </style>
</head>
<body>
  <div id="error-overlay"></div>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private previewVersion = 0;

  private async updatePreview(mdxContent: string) {
    if (!this.panel) {
        return;
    }
    
    const version = ++this.previewVersion;
    const baseUrl = this.currentDocumentUri?.toString();
    
    try {
      const jsCode = await MdxCompiler.compileToJS(mdxContent, baseUrl);
      // Discard if a newer update was queued while compiling
      if (version === this.previewVersion) {
        this.panel.webview.postMessage({ command: 'update', code: jsCode });
      }
    } catch (err: any) {
      if (version === this.previewVersion) {
        this.panel.webview.postMessage({ command: 'error', text: err.message || String(err) });
      }
    }
  }

  public dispose() {
    const panel = this.panel;
    this.panel = undefined;
    if (panel) {
      panel.dispose();
    }
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }
    this.currentDocumentUri = undefined;
  }
}

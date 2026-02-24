import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

export class TranslatorWebviewPanel {
  public static currentPanel: TranslatorWebviewPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _md: MarkdownIt;
  private readonly _targetExtensionUri: vscode.Uri | undefined;
  private _disposables: vscode.Disposable[] = [];

  // -----------------------------------------------------------------------
  // Constructor / Factory
  // -----------------------------------------------------------------------

  private constructor(panel: vscode.WebviewPanel, targetExtensionUri: vscode.Uri | undefined) {
    this._panel = panel;
    this._targetExtensionUri = targetExtensionUri;
    this._md = new MarkdownIt({ html: true, linkify: true, typographer: true });

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Always recreates the panel so that `localResourceRoots` correctly
   * includes the target extension directory (images, assets, etc.).
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    targetExtensionUri?: vscode.Uri
  ): TranslatorWebviewPanel {
    // Dispose the previous panel to refresh localResourceRoots
    if (TranslatorWebviewPanel.currentPanel) {
      TranslatorWebviewPanel.currentPanel.dispose();
    }

    const column = vscode.window.activeTextEditor?.viewColumn;

    const resourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, 'assets')];
    if (targetExtensionUri) {
      resourceRoots.push(targetExtensionUri);
    }

    const panel = vscode.window.createWebviewPanel(
      'markdownSeeWebview',
      'Translated Extension',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: resourceRoots,
      }
    );

    TranslatorWebviewPanel.currentPanel = new TranslatorWebviewPanel(panel, targetExtensionUri);
    return TranslatorWebviewPanel.currentPanel;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Show an animated skeleton while waiting for the translation. */
  public setSkeleton(): void {
    this._panel.webview.html = this._buildHtml(true, '');
  }

  /** Render the translated markdown (with resolved images). */
  public setTranslatedMarkdown(markdown: string): void {
    let html = this._md.render(markdown);
    html = this._resolveImagePaths(html);
    this._panel.webview.html = this._buildHtml(false, html);
  }

  /** Show a simple error message inside the webview. */
  public setError(message: string): void {
    this._panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <body style="font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);">
        <h2>⚠️ Error</h2>
        <p style="color:var(--vscode-errorForeground);">${message}</p>
      </body>
      </html>`;
  }

  public dispose(): void {
    TranslatorWebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  // -----------------------------------------------------------------------
  // Image resolution
  // -----------------------------------------------------------------------

  /**
   * Replace relative `<img src="...">` paths with webview-compatible URIs
   * so that images bundled with the extension are displayed correctly.
   */
  private _resolveImagePaths(html: string): string {
    if (!this._targetExtensionUri) { return html; }

    const webview = this._panel.webview;
    const baseUri = this._targetExtensionUri;

    return html.replace(
      /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
      (match, before, src, after) => {
        // Keep absolute URLs and data URIs as-is
        if (/^(https?:\/\/|data:|vscode-)/i.test(src)) { return match; }

        const resolved = vscode.Uri.joinPath(baseUri, src);
        const webviewUri = webview.asWebviewUri(resolved);
        return `<img ${before}src="${webviewUri}"${after}>`;
      }
    );
  }

  // -----------------------------------------------------------------------
  // HTML builder
  // -----------------------------------------------------------------------

  private _buildHtml(isLoading: boolean, content: string): string {
    const skeleton = `
      <div class="skeleton">
        <div class="sk-title"></div>
        <div class="sk-line" style="width:80%"></div>
        <div class="sk-line" style="width:92%"></div>
        <div class="sk-line" style="width:65%"></div>
        <div class="sk-box"></div>
        <div class="sk-line" style="width:85%"></div>
        <div class="sk-line" style="width:55%"></div>
        <div class="sk-line" style="width:75%"></div>
        <div class="sk-box" style="height:100px"></div>
        <div class="sk-line" style="width:60%"></div>
      </div>`;

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Translated Extension</title>
  <style>
    /* ── Base ───────────────────────────────────────────────── */
    * { box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      line-height: 1.7;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px 64px;
      margin: 0;
    }

    /* ── Skeleton loading ──────────────────────────────────── */
    .skeleton { animation: fadeIn .4s ease-in; }

    .sk-title {
      height: 30px; width: 40%;
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-bottom: 22px; border-radius: 4px;
      animation: pulse 1.4s infinite;
    }
    .sk-line {
      height: 14px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-bottom: 10px; border-radius: 4px;
      animation: pulse 1.4s infinite;
    }
    .sk-box {
      height: 140px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin: 20px 0; border-radius: 6px;
      animation: pulse 1.4s infinite;
    }

    @keyframes pulse {
      0%,100% { opacity: .45; }
      50%     { opacity: .75; }
    }

    /* ── Content fade-in ───────────────────────────────────── */
    .content { animation: fadeIn .6s ease-out forwards; opacity: 0; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Headings ──────────────────────────────────────────── */
    h1 {
      font-size: 1.8em;
      font-weight: 600;
      margin: 0 0 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.1));
    }
    h2 {
      font-size: 1.4em;
      font-weight: 600;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06));
    }
    h3 { font-size: 1.15em; font-weight: 600; margin: 22px 0 8px; }
    h4 { font-size: 1.05em; font-weight: 600; margin: 18px 0 6px; }

    /* ── Links ─────────────────────────────────────────────── */
    a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }

    /* ── Images ────────────────────────────────────────────── */
    img {
      max-width: 100%;
      border-radius: 6px;
      margin: 8px 0;
    }

    /* ── Code ──────────────────────────────────────────────── */
    code {
      font-family: var(--vscode-editor-font-family, 'Fira Code', 'Cascadia Code', monospace);
      font-size: 0.9em;
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,.06));
      padding: 2px 6px;
      border-radius: 4px;
    }

    pre {
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,.06));
      padding: 14px 18px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code {
      background: none;
      padding: 0;
    }

    /* ── Blockquotes ───────────────────────────────────────── */
    blockquote {
      border-left: 4px solid var(--vscode-textBlockQuote-border, #3794ff);
      padding: 4px 16px;
      margin: 12px 0;
      color: var(--vscode-textBlockQuote-foreground);
      background: rgba(255,255,255,.02);
      border-radius: 0 4px 4px 0;
    }

    /* ── Tables ────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
    }
    th, td {
      text-align: left;
      padding: 8px 12px;
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.1));
    }
    th {
      font-weight: 600;
      background: rgba(255,255,255,.04);
    }
    tr:hover td {
      background: rgba(255,255,255,.02);
    }

    /* ── Lists ─────────────────────────────────────────────── */
    ul, ol { padding-left: 24px; margin: 8px 0; }
    li { margin: 4px 0; }

    /* ── Horizontal rule ───────────────────────────────────── */
    hr {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,.1));
      margin: 24px 0;
    }

    /* ── Badges (inline images in paragraphs, like shields.io) */
    p > a > img,
    p > img {
      display: inline-block;
      vertical-align: middle;
      border-radius: 3px;
      margin: 2px 4px 2px 0;
    }
  </style>
</head>
<body>
  ${isLoading ? skeleton : `<div class="content">${content}</div>`}
</body>
</html>`;
  }
}

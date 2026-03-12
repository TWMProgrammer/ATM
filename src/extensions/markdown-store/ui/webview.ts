import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

// =========================================================
// 🏷️ TYPES
// =========================================================

export interface TranslationTarget {
  extensionUri?: vscode.Uri;
  displayName?: string;
  iconRelativePath?: string;
  languageLabel?: string; // e.g. "🇪🇸 Español"
}

// =========================================================
// 🪟 PANEL
// =========================================================

export class TranslatorWebviewPanel {
  public static currentPanel: TranslatorWebviewPanel | undefined;

  private static readonly _md = new MarkdownIt({ html: true, linkify: true, typographer: true });

  private readonly _panel: vscode.WebviewPanel;
  private readonly _targetExtensionUri: vscode.Uri | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  // =========================================================
  // 🏗️ CONSTRUCTOR / FACTORY
  // =========================================================

  private constructor(panel: vscode.WebviewPanel, targetExtensionUri: vscode.Uri | undefined) {
    this._panel = panel;
    this._targetExtensionUri = targetExtensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // --- Message Handling ---
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'textSelected':
            if (message.text) {
              await vscode.env.clipboard.writeText(message.text);
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Always recreates the panel so that `localResourceRoots` correctly
   * includes the target extension directory (images, assets, etc.).
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    target?: TranslationTarget
  ): TranslatorWebviewPanel {
    // Dispose the previous panel to refresh localResourceRoots
    if (TranslatorWebviewPanel.currentPanel) {
      TranslatorWebviewPanel.currentPanel.dispose();
    }

    // --- Tab title ---
    let title = 'Translated Extension';
    if (target?.displayName && target?.languageLabel) {
      const shortName = target.displayName.split(/\s+/)[0];
      
      // Move flag to the end: "🇪🇸 Español" -> "Español 🇪🇸"
      let formattedLang = target.languageLabel;
      const spaceIndex = formattedLang.indexOf(' ');
      if (spaceIndex !== -1) {
        const flag = formattedLang.slice(0, spaceIndex);
        const name = formattedLang.slice(spaceIndex + 1);
        formattedLang = `${name} ${flag}`;
      }

      title = `${shortName} · ${formattedLang}`;
    } else if (target?.displayName) {
      const shortName = target.displayName.split(/\s+/)[0];
      title = `${shortName} · Translated`;
    }

    // --- Resource roots ---
    const resourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, 'assets')];
    if (target?.extensionUri) {
      resourceRoots.push(target.extensionUri);
    }

    const panel = vscode.window.createWebviewPanel(
      'markdownStoreWebview',
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: resourceRoots,
      }
    );

    // --- Tab icon (extension icon) ---
    if (target?.extensionUri && target?.iconRelativePath) {
      panel.iconPath = vscode.Uri.joinPath(target.extensionUri, target.iconRelativePath);
    }

    TranslatorWebviewPanel.currentPanel = new TranslatorWebviewPanel(panel, target?.extensionUri);
    return TranslatorWebviewPanel.currentPanel;
  }

  // =========================================================
  // 🚀 PUBLIC API
  // =========================================================

  /** Show an animated skeleton while waiting for the translation. */
  public setSkeleton(): void {
    this._panel.webview.html = this._buildHtml(true, '');
  }

  /** Render the translated markdown (with resolved images). */
  public setTranslatedMarkdown(markdown: string): void {
    let html = TranslatorWebviewPanel._md.render(markdown);
    html = this._resolveImagePaths(html);
    this._panel.webview.html = this._buildHtml(false, html);
  }

  /** Show a simple error message inside the webview. */
  public setError(message: string): void {
    const safe = escapeHtml(message);
    this._panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <body style="font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);">
        <h2>⚠️ Error</h2>
        <p style="color:var(--vscode-errorForeground);">${safe}</p>
      </body>
      </html>`;
  }

  /** Whether this panel has been disposed (closed). */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public dispose(): void {
    this._isDisposed = true;
    TranslatorWebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  // =========================================================
  // 🖼️ IMAGE RESOLUTION
  // =========================================================

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

  // =========================================================
  // 🌐 HTML BUILDER
  // =========================================================

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
        <div class="sk-line" style="width:88%"></div>
        <div class="sk-line" style="width:70%"></div>
        <div class="sk-title" style="width:35%;margin-top:28px"></div>
        <div class="sk-line" style="width:78%"></div>
        <div class="sk-line" style="width:90%"></div>
        <div class="sk-line" style="width:50%"></div>
        <div class="sk-box" style="height:120px"></div>
        <div class="sk-line" style="width:82%"></div>
        <div class="sk-line" style="width:68%"></div>
        <div class="sk-line" style="width:74%"></div>
      </div>`;

    const cspSource = this._panel.webview.cspSource;

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; media-src ${cspSource} https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
    .skeleton { animation: fadeIn .4s ease-in; min-height: calc(100vh - 88px); }

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

    video {
      max-width: 100%;
      border-radius: 6px;
      margin: 10px 0;
      background: var(--vscode-editorWidget-background, rgba(0,0,0,.2));
    }

    /* ── Release Notes media placeholder (lightweight UI fallback) ─────── */
    atm-media-placeholder {
      position: relative;
      display: block;
      width: 100%;
      min-height: 220px;
      margin: 18px 0;
      border-radius: 14px;
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.14));
      background:
        radial-gradient(120% 150% at 10% 10%, rgba(33, 150, 243, 0.18) 0%, rgba(33, 150, 243, 0) 45%),
        radial-gradient(120% 120% at 90% 90%, rgba(0, 200, 120, 0.16) 0%, rgba(0, 200, 120, 0) 50%),
        linear-gradient(160deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
      box-shadow: 0 14px 34px rgba(0, 0, 0, .28);
      overflow: hidden;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    atm-media-placeholder::before {
      content: "MEDIA";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      letter-spacing: .14em;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--vscode-descriptionForeground, rgba(255,255,255,.7));
      text-shadow: 0 2px 18px rgba(0, 0, 0, .45);
    }

    atm-media-placeholder::after {
      content: "Image official in left <-";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 14px;
      text-align: center;
      font-size: .88rem;
      font-weight: 500;
      color: var(--vscode-descriptionForeground, rgba(255,255,255,.7));
      opacity: .95;
      letter-spacing: .02em;
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

    /* ── Badges & inline icons (shields.io, favicons in lists, etc.) */
    p > a > img,
    p > img,
    li > img,
    li > a > img {
      display: inline-block;
      vertical-align: middle;
      border-radius: 3px;
      margin: 2px 4px 2px 0;
    }

    /* ── Scroll-to-top button ─────────────────────────────── */
    .scroll-top-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.15));
      background: var(--vscode-editor-background);
      color: var(--vscode-textLink-foreground);
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity .3s, transform .2s;
      z-index: 100;
    }
    .scroll-top-btn.visible {
      opacity: .6;
      pointer-events: auto;
    }
    .scroll-top-btn:hover {
      opacity: 1;
      transform: scale(1.1);
    }
  </style>
</head>
<body>
  ${isLoading ? skeleton : `<div class="content">${content}</div>
  <button class="scroll-top-btn" id="scrollTopBtn" title="Scroll to top"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.5l-5 5 .7.7L8 5.9l4.3 4.3.7-.7z"/></svg></button>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const btn = document.getElementById('scrollTopBtn');
      
      btn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      window.addEventListener('scroll', function() {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        btn.classList.toggle('visible', scrollPercent > 0.2);
      });

      // 🎤 ATM Voice TTS Bridge
      // Listens for text selection and "silently" copies it for Voice TTS
      document.addEventListener('mouseup', () => {
        const selection = window.getSelection().toString().trim();
        if (selection) {
          vscode.postMessage({
            command: 'textSelected',
            text: selection
          });
        }
      });
    })();
  </script>`}
</body>
</html>`;
  }
}

// =========================================================
// 🛠️ HELPERS
// =========================================================

/** Escape HTML special characters to prevent XSS injection. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

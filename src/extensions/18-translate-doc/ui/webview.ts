import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { escapeHtml } from '../core/utils';

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
  private readonly _extensionUri: vscode.Uri;
  private readonly _targetExtensionUri: vscode.Uri | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;

  // =========================================================
  // 🏗️ CONSTRUCTOR / FACTORY
  // =========================================================

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, targetExtensionUri: vscode.Uri | undefined) {
    this._panel = panel;
    this._extensionUri = extensionUri;
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
      const [flag, ...rest] = formattedLang.split(' ');
      if (rest.length > 0) {
        formattedLang = `${rest.join(' ')} ${flag}`;
      }

      title = `${shortName} · ${formattedLang}`;
    } else if (target?.displayName) {
      const shortName = target.displayName.split(/\s+/)[0];
      title = `${shortName} · Translated`;
    }

    // --- Resource roots ---
    const resourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, 'src')];
    if (target?.extensionUri) {
      resourceRoots.push(target.extensionUri);
    }

    const panel = vscode.window.createWebviewPanel(
      'markdownStoreWebview',
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: resourceRoots,
      }
    );

    // --- Tab icon (extension icon) ---
    if (target?.extensionUri && target?.iconRelativePath) {
      panel.iconPath = vscode.Uri.joinPath(target.extensionUri, target.iconRelativePath);
    }

    TranslatorWebviewPanel.currentPanel = new TranslatorWebviewPanel(panel, extensionUri, target?.extensionUri);
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
      <div class="skeleton-doc">
        <!-- Big Document Title -->
        <div class="sk-doc-item sk-title"></div>
        
        <!-- Subtle meta info (e.g. date, author) -->
        <div class="sk-meta">
          <div class="sk-doc-item sk-meta-item"></div>
          <div class="sk-doc-item sk-meta-item" style="width: 120px;"></div>
        </div>
        
        <div class="sk-separator"></div>
        
        <!-- Introduction Paragraph -->
        <div class="sk-paragraph">
          <div class="sk-doc-item sk-line w-100"></div>
          <div class="sk-doc-item sk-line w-95"></div>
          <div class="sk-doc-item sk-line w-90"></div>
          <div class="sk-doc-item sk-line w-60"></div>
        </div>

        <!-- Large Content Area (Image or Code space, occupies remaining height) -->
        <div class="sk-doc-item sk-block-large"></div>
        
        <!-- Secondary Section Header & List -->
        <div class="sk-doc-item sk-line w-40" style="height: 22px; margin-bottom: 8px;"></div>
        <div class="sk-list">
          <div class="sk-list-item"><div class="sk-bullet"></div><div class="sk-doc-item sk-line w-85"></div></div>
          <div class="sk-list-item"><div class="sk-bullet"></div><div class="sk-doc-item sk-line w-100"></div></div>
          <div class="sk-list-item"><div class="sk-bullet"></div><div class="sk-doc-item sk-line w-60"></div></div>
        </div>
      </div>`;

    const cspSource = this._panel.webview.cspSource;
    const cssUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'extensions', '18-translate-doc', 'ui', 'skeleton', 'translate-doc.css')
    );

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; media-src ${cspSource} https: data:; style-src ${cspSource}; script-src 'unsafe-inline';">
  <title>Translated Extension</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  ${isLoading ? skeleton : `<div class="content">${content}</div>
  <button class="scroll-top-btn" id="scrollTopBtn" title="Scroll to top"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.5l-5 5 .7.7L8 5.9l4.3 4.3.7-.7z"/></svg></button>
  <div class="tts-badge" id="ttsBadge">📋 Copied for TTS</div>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const btn = document.getElementById('scrollTopBtn');
      const ttsBadge = document.getElementById('ttsBadge');
      let ttsTimeout = null;

      btn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      window.addEventListener('scroll', function() {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        btn.classList.toggle('visible', scrollPercent > 0.2);
      });

      // 🎤 ATM Voice TTS Bridge — copies selection and shows a brief badge
      document.addEventListener('mouseup', () => {
        const selection = window.getSelection().toString().trim();
        if (selection) {
          vscode.postMessage({ command: 'textSelected', text: selection });

          // Show feedback badge so the user knows the copy happened
          ttsBadge.classList.add('visible');
          clearTimeout(ttsTimeout);
          ttsTimeout = setTimeout(() => ttsBadge.classList.remove('visible'), 1500);
        }
      });
    })();
  </script>`}
</body>
</html>`;
  }
}

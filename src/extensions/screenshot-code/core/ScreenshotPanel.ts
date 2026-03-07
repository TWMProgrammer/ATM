import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export class ScreenshotPanel {
  public static currentPanel: ScreenshotPanel | undefined;
  public static readonly viewType = 'atmScreenshotCode';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];



  /* ─── Factory ──────────────────────────── */

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (ScreenshotPanel.currentPanel) {
      ScreenshotPanel.currentPanel._panel.reveal(column, true);
      ScreenshotPanel.currentPanel.updateCode();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ScreenshotPanel.viewType,
      'Screenshot 📸',
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(
            context.extensionUri,
            'src',
            'extensions',
            'screenshot-code',
            'assets'
          ),
        ],
      }
    );

    ScreenshotPanel.currentPanel = new ScreenshotPanel(
      panel,
      context.extensionUri
    );
  }

  /* ─── Constructor ──────────────────────── */

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();
    this.updateCode();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'saveImage':
            await this._saveImage(message.data);
            return;
          case 'error':
            vscode.window.showErrorMessage(
              `Screenshot Error: ${message.text}`
            );
            return;
        }
      },
      null,
      this._disposables
    );


  }

  /* ─── Selection check ─────────────────── */

  private _hasSelection(selections: readonly vscode.Selection[]): boolean {
    return (
      selections !== undefined &&
      selections.length === 1 &&
      !selections[0].isEmpty
    );
  }

  /* ─── Push code to webview ─────────────── */

  public async updateCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this._hasSelection(editor.selections)) {
      return;
    }

    try {
      // Copy with syntax highlighting so the webview can paste coloured HTML
      await vscode.commands.executeCommand(
        'editor.action.clipboardCopyWithSyntaxHighlightingAction'
      );

      const config = vscode.workspace.getConfiguration('editor');
      const fontLigatures = config.get<boolean | string>(
        'fontLigatures',
        false
      );
      const tabSize = (editor.options.tabSize as number) || 4;

      const activeFileName = path.basename(editor.document.uri.fsPath);
      const workspaceName = vscode.workspace.name;
      const windowTitle = workspaceName ? `${workspaceName} — ${activeFileName}` : activeFileName;

      const startLine = editor.selection.start.line;
      const plainText = editor.document.getText(editor.selection);

      this._panel.webview.postMessage({
        type: 'update',
        fontLigatures,
        tabSize,
        windowTitle,
        startLine,
        plainText,
      });
    } catch (error) {
      console.error('[ScreenshotPanel] Failed to update code', error);
    }
  }

  /* ─── Save image to disk ───────────────── */

  private async _saveImage(dataBase64: string) {
    try {
      const base64Data = dataBase64.replace(/^data:image\/\w+;base64,/, '');

      // Detect format from the data URL
      const formatMatch = dataBase64.match(/^data:image\/(\w+);/);
      const format = formatMatch ? formatMatch[1] : 'png';

      const extension = format === 'jpeg' ? 'jpg' : format;

      const uri = await vscode.window.showSaveDialog({
        filters: { Images: [extension] },
        defaultUri: vscode.Uri.file(
          path.join(os.homedir(), 'Desktop', `code-screenshot.${extension}`)
        ),
      });

      if (uri) {
        const buffer = Buffer.from(base64Data, 'base64');
        await vscode.workspace.fs.writeFile(uri, buffer);
        vscode.window.showInformationMessage('Screenshot saved! 📸');
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to save the screenshot.');
      console.error('[ScreenshotPanel]', error);
    }
  }

  /* ─── Dispose ──────────────────────────── */

  public dispose() {
    ScreenshotPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /* ─── Update webview content ───────────── */

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'Screenshot 📸';
    webview.html = this._getHtmlForWebview(webview);
  }

  /* ─── HTML generation ──────────────────── */

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'styles.css')
    );

    const downloadIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'src',
        'extensions',
        'screenshot-code',
        'assets',
        'download.svg'
      )
    );

    const csp = webview.cspSource;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src ${csp} data: blob:;
               style-src 'unsafe-inline' ${csp};
               script-src 'unsafe-eval' ${csp};
               connect-src data: blob:;">
    <title>Screenshot 📸</title>
    <link href="${cssUri}" rel="stylesheet">
</head>
<body>
    <div id="app">

        <!-- ─── Toolbar ───────────────────── -->
        <div id="toolbar">
            <button id="btn-save" title="Save as PNG" class="action-btn primary">
                <img src="${downloadIconUri}" alt="Save" />
                Save
            </button>
            <button id="btn-copy" title="Copy to clipboard" class="action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
            </button>

            <div class="divider"></div>

            <!-- Gradient presets -->
            <div class="control-label">
                BG
                <div id="gradient-presets" class="gradient-presets"></div>
                <input type="color" id="bg-color-picker" value="#667eea" title="Custom colour" />
            </div>

            <div class="divider"></div>

            <!-- Padding -->
            <div class="slider-group">
                <span class="control-label">PAD</span>
                <input type="range" id="padding-slider" min="0" max="96" value="48" />
            </div>

            <div class="divider"></div>

            <!-- Toggles -->
            <button id="btn-toggle-bg" class="toggle-btn" title="Transparent background">No BG</button>
            <button id="btn-toggle-shadow" class="toggle-btn active" title="Toggle shadow">Shadow</button>
            <button id="btn-toggle-chrome" class="toggle-btn active" title="Toggle window bar">Chrome</button>
            <button id="btn-toggle-lines" class="toggle-btn active" title="Toggle line numbers">Lines</button>
        </div>

        <!-- ─── Snippet Area ──────────────── -->
        <div id="snippet-scroll">
            <div id="snippet-container" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div id="window" class="glass-panel">
                    <div id="navbar">
                        <div id="window-controls">
                            <div class="mac-dot red"></div>
                            <div class="mac-dot yellow"></div>
                            <div class="mac-dot green"></div>
                        </div>
                        <div id="window-title">code.ts</div>
                    </div>
                    <div id="snippet-content"></div>
                </div>
            </div>
        </div>

        <div id="flash-fx"></div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

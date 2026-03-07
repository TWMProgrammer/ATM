import * as vscode from 'vscode';
import * as path from 'path';

export class ScreenshotPanel {
  public static currentPanel: ScreenshotPanel | undefined;
  public static readonly viewType = 'atmScreenshotCode';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _selectionTimeout: NodeJS.Timeout | null = null;
  private _isActive = true;

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
      'ATM Screenshot 📸',
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', 'screenshot-code', 'assets')
        ]
      }
    );

    ScreenshotPanel.currentPanel = new ScreenshotPanel(panel, context.extensionUri);
  }

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
            await this.saveImage(message.data);
            return;
          case 'error':
            vscode.window.showErrorMessage(`Screenshot Code Error: ${message.text}`);
            return;
        }
      },
      null,
      this._disposables
    );

    // Debounce the selection changes to avoid lag
    vscode.window.onDidChangeTextEditorSelection(
      (e) => {
        if (!this._isActive || !this._panel.visible) { return; }

        if (this._selectionTimeout) {
          clearTimeout(this._selectionTimeout);
        }

        this._selectionTimeout = setTimeout(() => {
          if (this.hasOneSelection(e.selections)) {
            this.updateCode();
          }
        }, 250);
      },
      null,
      this._disposables
    );
  }

  private hasOneSelection(selections: readonly vscode.Selection[]): boolean {
    return selections && selections.length === 1 && !selections[0].isEmpty;
  }

  public async updateCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.hasOneSelection(editor.selections)) {
      return;
    }

    try {
      // Force VS Code to copy format and syntax highlighting
      await vscode.commands.executeCommand('editor.action.clipboardCopyWithSyntaxHighlightingAction');
      
      const config = vscode.workspace.getConfiguration('editor');
      const fontLigatures = config.get('fontLigatures', false);
      const tabSize = editor.options.tabSize || 4;

      const activeFileName = path.basename(editor.document.uri.fsPath);
      const windowTitle = `${vscode.workspace.name || 'Workspace'} - ${activeFileName}`;

      const selection = editor.selection;
      const startLine = selection.start.line;

      this._panel.webview.postMessage({
        type: 'update',
        fontLigatures,
        tabSize,
        windowTitle,
        startLine
      });
    } catch (error) {
      console.error('Failed to update screenshot panel code', error);
    }
  }

  private async saveImage(dataBase64: string) {
    try {
      // It returns data:image/jpeg;base64,...
      const base64Data = dataBase64.replace(/^data:image\/\w+;base64,/, "");
      
      const uri = await vscode.window.showSaveDialog({
        filters: { Images: ['jpg', 'png', 'webp'] },
        defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'Desktop', 'code-screenshot.jpg'))
      });

      if (uri) {
        const buffer = Buffer.from(base64Data, 'base64');
        await vscode.workspace.fs.writeFile(uri, buffer);
        vscode.window.showInformationMessage('Screenshot saved successfully! 📸');
      }
    } catch (error) {
      vscode.window.showErrorMessage('Failed to save the image.');
      console.error(error);
    }
  }

  public dispose() {
    this._isActive = false;
    ScreenshotPanel.currentPanel = undefined;

    this._panel.dispose();

    if (this._selectionTimeout) {
      clearTimeout(this._selectionTimeout);
    }

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'ATM Screenshot 📸';
    webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'screenshotWebview.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'screenshotWebview.css')
    );

    const downloadIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'extensions', 'screenshot-code', 'assets', 'download.svg')
    );

    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob:; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-eval' ${cspSource};">
    <title>ATM Screenshot 📸</title>
    <link href="${cssUri}" rel="stylesheet">
</head>
<body>
    <div id="app">
        <div id="toolbar">
            <button id="btn-save" title="Save Base Image (JPG)" class="action-btn">
                <img src="${downloadIconUri}" alt="Save" />
            </button>
            <button id="btn-copy" title="Copy to Clipboard (PNG)" class="action-btn text-btn">
                Copy
            </button>
            <div class="divider"></div>
            <label class="control-label">
              Background
              <input type="color" id="bg-color-picker" value="#9b51e0" />
            </label>
        </div>

        <div id="snippet-scroll">
            <div id="snippet-container" style="--container-bg: #9b51e0;">
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

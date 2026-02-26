import * as vscode from 'vscode';
import * as path from 'path';
import { MdxCompiler } from '../core/MdxCompiler';

export class MdxPreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private currentDocumentUri: vscode.Uri | undefined;
  private readonly updateDebounceMs = 300;
  private updateTimeout: NodeJS.Timeout | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public showPreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active MDX document to preview.');
      return;
    }

    if (!['mdx', 'markdown'].includes(editor.document.languageId)) {
      vscode.window.showErrorMessage('Active document is not an MDX or Markdown file.');
      return;
    }

    this.currentDocumentUri = editor.document.uri;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
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

      this.panel.onDidDispose(() => {
        this.dispose();
      }, null, this.disposables);

      // Listen to text changes to live-update the preview
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === this.currentDocumentUri?.toString()) {
          this.queueUpdate(e.document.getText());
        }
      }, null, this.disposables);
      
      // Listen to active editor changes to switch preview document
      vscode.window.onDidChangeActiveTextEditor((e) => {
        if (e && ['mdx', 'markdown'].includes(e.document.languageId)) {
          this.currentDocumentUri = e.document.uri;
          this.queueUpdate(e.document.getText());
        }
      }, null, this.disposables);
    }

    this.updatePreview(editor.document.getText());
  }

  private queueUpdate(text: string) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => {
      this.updatePreview(text);
    }, this.updateDebounceMs);
  }

  private async updatePreview(mdxContent: string) {
    if (!this.panel) { return; }

    try {
      // 1. Compile MDX to JS Function Body
      const jsCode = await MdxCompiler.compileToJS(mdxContent);
      
      // 2. Wrap the HTML including React + ReactDOM and our customized JS evaluator
      const html = this.getHtmlForWebview(jsCode);
      this.panel.webview.html = html;
    } catch (err: any) {
      this.panel.webview.html = this.getErrorHtml(err.message || String(err));
    }
  }

  private getHtmlForWebview(jsFunctionBody: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MDX Preview</title>
  <!-- Load React from CDN (fast cache, lightweight payload) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  
  <style>
    body {
      padding: 20px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      line-height: 1.6;
    }
    
    /* Some basic styling for MDX output matching VSCode Markdown */
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
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-overlay"></div>

  <script>
    (function() {
      const rootEl = document.getElementById('root');
      const errEl = document.getElementById('error-overlay');
      
      try {
        // Our customized JSX runtime provider simulating react/jsx-runtime
        function jsx(type, props, key) {
          const { children, ...rest } = props || {};
          if (key !== undefined) {
            rest.key = key;
          }
          if (children !== undefined && children !== null) {
            return React.createElement(type, rest, children);
          }
          return React.createElement(type, rest);
        }

        function jsxs(type, props, key) {
          const { children, ...rest } = props || {};
          if (key !== undefined) {
            rest.key = key;
          }
          if (Array.isArray(children)) {
            return React.createElement(type, rest, ...children);
          }
          return React.createElement(type, rest, children);
        }

        const jsxCodeString = ${JSON.stringify(jsFunctionBody).replace(/</g, '\\u003c')};
        const runTarget = new Function(jsxCodeString);

        const modArgs = {
          Fragment: React.Fragment,
          jsx: jsx,
          jsxs: jsxs
        };

        const executeMdx = runTarget(modArgs);
        
        // Render the default export Component
        const MDXContent = executeMdx.default;
        
        if (typeof MDXContent === 'function') {
           const root = ReactDOM.createRoot(rootEl);
           root.render(React.createElement(MDXContent, {}));
        } else {
           throw new Error("No default export found from MDX evaluation.");
        }
      } catch (err) {
        errEl.innerText = err.stack || err.toString();
        console.error(err);
      }
    })();
  </script>
</body>
</html>`;
  }

  private getErrorHtml(errorMsg: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body {
      font-family: monospace;
      padding: 20px;
      color: var(--vscode-errorForeground);
    }
    pre {
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h3>MDX Compilation Error</h3>
  <pre>${errorMsg}</pre>
</body>
</html>`;
  }

  public dispose() {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.currentDocumentUri = undefined;
  }
}

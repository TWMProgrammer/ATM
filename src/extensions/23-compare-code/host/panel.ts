import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  createDynamicIconManager,
  DynamicIconManager,
  getWebviewIcons,
  replaceIconsInHtml,
} from './icons';
import { handleWebviewMessage } from './messages';

// ======================================
// COMPARE VIEW PANEL | MARK: PANEL
// ======================================

export const compareCodeViewType = 'atm.compareCode';

const MODULE_SEGMENTS = ['src', 'extensions', '23-compare-code'] as const;

let comparePanel: vscode.WebviewPanel | undefined;
let iconManager: DynamicIconManager | undefined;

function moduleUri(context: vscode.ExtensionContext, ...segments: string[]): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, ...MODULE_SEGMENTS, ...segments);
}

/** Create (or reveal) the compare-code webview. */
export function createCompareView(context: vscode.ExtensionContext): void {
  if (comparePanel) {
    comparePanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    compareCodeViewType,
    'Compare Code',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        moduleUri(context, 'assets'),
      ],
    }
  );

  panel.iconPath = {
    light: moduleUri(context, 'assets', 'icons', 'light', 'cc.svg'),
    dark: moduleUri(context, 'assets', 'icons', 'dark', 'cc.svg'),
  };

  panel.webview.html = getWebviewHtml(context, panel.webview);

  iconManager = createDynamicIconManager(context, panel.webview);

  const disposables: vscode.Disposable[] = [];
  panel.webview.onDidReceiveMessage(
    (message) => void handleWebviewMessage(message),
    undefined,
    disposables
  );

  panel.onDidDispose(
    () => {
      iconManager?.dispose();
      iconManager = undefined;
      comparePanel = undefined;
      vscode.Disposable.from(...disposables).dispose();
    },
    undefined,
    context.subscriptions
  );

  comparePanel = panel;
}

/** Close the compare-code webview if it is open. */
export function closeCompareView(): void {
  comparePanel?.dispose();
  comparePanel = undefined;
  iconManager?.dispose();
  iconManager = undefined;
}

/** Whether the panel is currently open and visible. */
export function isViewOpen(): boolean {
  return comparePanel !== undefined && comparePanel.visible;
}

// ======================================
// HTML GENERATION | MARK: HTML
// ======================================

function getWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const html = fs.readFileSync(moduleUri(context, 'ui', 'compare-code.html').fsPath, 'utf8');
  const css = fs.readFileSync(moduleUri(context, 'ui', 'compare-code.css').fsPath, 'utf8');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'compare-code.js')
  );

  const nonce = crypto.randomUUID().replace(/-/g, '');

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const icons = getWebviewIcons(context, webview);
  const locale = vscode.env.language || 'en';

  return replaceIconsInHtml(html, icons)
    .replace(
      '<!-- CC_HEAD -->',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>${css}</style>`
    )
    .replace('<!-- CC_SCRIPT -->', `<script src="${scriptUri}" nonce="${nonce}"></script>`)
    .replace('{{LOCALE}}', escapeAttribute(locale));
}

/** Escape a value destined for an HTML attribute. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

import * as fs from 'fs';
import * as vscode from 'vscode';

export function activateIra(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('atm.ira.open', () => {
    const panel = vscode.window.createWebviewPanel(
      'atmIra',
      'ATM IRA',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'ui'),
          vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'assets'),
        ],
      }
    );

    panel.iconPath = vscode.Uri.file(
      context.asAbsolutePath('src/assets/atm-logo.png')
    );

    vscode.commands.executeCommand('setContext', 'atm.ira.active', true);

    panel.onDidChangeViewState(e => {
      vscode.commands.executeCommand('setContext', 'atm.ira.active', e.webviewPanel.active);
    });

    panel.onDidDispose(() => {
      vscode.commands.executeCommand('setContext', 'atm.ira.active', false);
    });

    panel.webview.html = getWebviewContent(context);
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext): string {
  const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'ui');
  const assetsRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'assets');
  const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ui.html').fsPath, 'utf8');
  const css = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ui.css').fsPath, 'utf8');

  const browserIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'browser.svg').fsPath);
  const compareIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'compare-code.svg').fsPath);
  const translateIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'translate.svg').fsPath);
  const gitIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'git.svg').fsPath);

  return html
    .replace('<!-- ATM_IRA_STYLES -->', `<style>\n${css}\n\t</style>`)
    .replace('<!-- ATM_IRA_ICON_BROWSER -->', browserIcon)
    .replace('<!-- ATM_IRA_ICON_COMPARE -->', compareIcon)
    .replace('<!-- ATM_IRA_ICON_TRANSLATE -->', translateIcon)
    .replace('<!-- ATM_IRA_ICON_GIT -->', gitIcon);
}

function inlineSvg(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/<style[\s\S]*?<\/style>/gi, '');
}

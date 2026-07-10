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

    panel.webview.html = getWebviewContent(context, panel.webview);
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'ui');
  const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ui.html').fsPath, 'utf8');
  const css = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ui.css').fsPath, 'utf8');

  return html.replace('<!-- ATM_IRA_STYLES -->', `<style>\n${css}\n\t</style>`);
}

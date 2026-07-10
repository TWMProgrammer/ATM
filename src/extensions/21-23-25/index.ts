import * as vscode from 'vscode';

export function activateIra(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('atm.ira.open', () => {
    const panel = vscode.window.createWebviewPanel(
      'atmIra',
      'ATM IRA',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    panel.iconPath = vscode.Uri.file(
      context.asAbsolutePath('src/extensions/21-atm-translate/assets/atm-logo.png')
    );

    vscode.commands.executeCommand('setContext', 'atm.ira.active', true);

    panel.onDidChangeViewState(e => {
      vscode.commands.executeCommand('setContext', 'atm.ira.active', e.webviewPanel.active);
    });

    panel.onDidDispose(() => {
      vscode.commands.executeCommand('setContext', 'atm.ira.active', false);
    });

    panel.webview.html = getWebviewContent();
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ATM IRA</title>
</head>
<body>
    <h1>hello Wold</h1>
</body>
</html>`;
}

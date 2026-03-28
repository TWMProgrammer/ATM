import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openScreenshotPanel(extensionUri: vscode.Uri, payload?: { image: string, nickname: string }) {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'atomScreenshot',
    'Atom Screenshot',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    }
  );

  // Set the panel icon
  currentPanel.iconPath = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', 'focus', 'screens', 'atm-game', 'assets', 'cursor.svg');

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
  );

  const nicknameDisplay = payload?.nickname ? `@${payload.nickname}` : 'Atom';

  // Load UI files
  const htmlPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-game', 'screenshot', 'ui', 'index.html');
  const cssPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-game', 'screenshot', 'ui', 'index.css');
  const iconPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-game', 'assets', 'cursor.svg');

  const htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const cursorIcon = fs.readFileSync(iconPath, 'utf8');

  const imageTag = payload?.image ? `<img src="${payload.image}" alt="Atom Screenshot" />` : '<div style="color: grey; padding: 2rem;">No image captured</div>';

  // Inject content
  let html = htmlTemplate.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.split('{{cursorIcon}}').join(cursorIcon);
  html = html.replace('{{imageTag}}', imageTag);

  currentPanel.webview.html = html;
}

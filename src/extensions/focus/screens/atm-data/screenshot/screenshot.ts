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
  const iconPathDark = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor.svg');
  const iconPathLight = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor-light.svg');
  currentPanel.iconPath = {
    light: iconPathLight,
    dark: iconPathDark
  };

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
  );

  let nicknameDisplay = 'Atom';
  if (payload?.nickname) {
    nicknameDisplay = payload.nickname.startsWith('@') ? payload.nickname : `@${payload.nickname}`;
  }

  // Load UI files
  const htmlPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'ui', 'index.html');
  const cssPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'ui', 'index.css');
  const iconPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor.svg');

  const htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const cursorIcon = fs.readFileSync(iconPath, 'utf8');

  const imageTag = payload?.image ? `<img src="${payload.image}" alt="Atom Screenshot" />` : '<div style="color: grey; padding: 2rem;">No image captured</div>';

  // Make user image accessible
  const userImgPath = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'user.jpeg');
  const userImgUri = currentPanel.webview.asWebviewUri(userImgPath);

  // Inject content
  let html = htmlTemplate.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.split('{{cursorIcon}}').join(cursorIcon);
  html = html.replace('{{imageTag}}', imageTag);
  html = html.replace('{{userImageUri}}', userImgUri.toString());

  currentPanel.webview.html = html;
}

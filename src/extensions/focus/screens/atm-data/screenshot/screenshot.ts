import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openScreenshotPanel(extensionUri: vscode.Uri, payload?: { image?: string, nickname?: string }, onStateChange?: (isOpen: boolean) => void) {
  if (currentPanel) {
    updateScreenshotContent(currentPanel, extensionUri, payload);
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

  if (onStateChange) onStateChange(true);

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
      if (onStateChange) onStateChange(false);
    },
    null,
  );

  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'closePanel':
          if (currentPanel) currentPanel.dispose();
          return;
        case 'saveImage':
          await handleSaveImage(message.data);
          return;
        case 'openExternalBrowser':
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          return;
        case 'error':
          vscode.window.showErrorMessage(`Screenshot Error: ${message.text}`);
          return;
      }
    },
    undefined,
  );

  updateScreenshotContent(currentPanel, extensionUri, payload);
}

async function handleSaveImage(dataBase64: string) {
  try {
    const base64Data = dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const now = new Date();
    const ts = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    
    const uri = await vscode.window.showSaveDialog({
      filters: { Images: ['png'] },
      defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Downloads', `ATM-stats-${ts}.png`)),
    });

    if (uri) {
      const buffer = Buffer.from(base64Data, 'base64');
      await vscode.workspace.fs.writeFile(uri, buffer);
      vscode.window.showInformationMessage('Screenshot saved! 📸');
    }
  } catch (error) {
    vscode.window.showErrorMessage('Failed to save the screenshot.');
    console.error('[ATM-Data Screenshot]', error);
  }
}


function updateScreenshotContent(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, payload?: { image?: string, nickname?: string }) {
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

  // Make app.js accessible
  const appJsPath = vscode.Uri.joinPath(extensionUri, 'dist', 'app.js');
  const appJsUri = panel.webview.asWebviewUri(appJsPath);

  // Make user image accessible
  const userImgPath = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'user.jpeg');
  const userImgUri = panel.webview.asWebviewUri(userImgPath);

  const cspSource = panel.webview.cspSource;
  const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob: https:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-eval' 'unsafe-inline'; font-src ${cspSource} data:; connect-src ${cspSource} data: blob:;">`;

  // Inject content
  let html = htmlTemplate.replace('<head>', `<head>\n${cspMetaTag}`);
  html = html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.split('{{cursorIcon}}').join(cursorIcon);
  html = html.replace('{{imageTag}}', imageTag);
  html = html.replace('{{userImageUri}}', userImgUri.toString());
  html = html.replace('</body>', `<script src="${appJsUri}"></script></body>`);

  panel.webview.html = html;
}

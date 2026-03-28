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
    'Atom Screenshot $(cursor)',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    }
  );

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

  const htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Cursor Icon SVG (VSCode style $(cursor))
  const cursorIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.623 11.649l5.053 10.351-1.802.881-5.053-10.352-3.141 3.142v-13.671l10.352 10.352-5.409-.703z" fill="var(--accent-color)"/>
  </svg>`;

  const imageTag = payload?.image ? `<img src="${payload.image}" alt="Atom Screenshot" />` : '<div style="color: grey; padding: 2rem;">No image captured</div>';

  // Inject content
  let html = htmlTemplate.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.replace('{{cursorIcon}}', cursorIcon);
  html = html.replace('{{imageTag}}', imageTag);

  currentPanel.webview.html = html;
}

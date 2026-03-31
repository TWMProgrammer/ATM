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
        case 'requestData':
          try {
            const data = await fetchDashboardData(message.nickname);
            currentPanel?.webview.postMessage({ command: 'updateData', data });
          } catch (e) {
            console.error(e);
          }
          return;
      }
    },
    undefined,
  );

  updateScreenshotContent(currentPanel, extensionUri, payload);
}

export async function refreshScreenshotPanelData(nickname: string) {
    if (!currentPanel) return;
    
    // Tell webview to show skeletons while we load new data
    currentPanel.webview.postMessage({ command: 'showSkeletons' });
    
    try {
        const data = await fetchDashboardData(nickname);
        currentPanel.webview.postMessage({ command: 'updateData', data, newNickname: nickname });
    } catch (e) {
        console.error('Error refreshing screenshot data:', e);
    }
}

import * as https from 'https';
import { exec } from 'child_process';
import * as util from 'util';
const execAsync = util.promisify(exec);

async function fetchDashboardData(nickname: string) {
    let commitsToday = 0;
    let filesChanged = 0;
    let totalCommits = 0;
    let followers = 0;
    let following = 0;
    let years = 1;
    let dayStreak = 0;
    let bio = "An initiate of programming.";
    let totalCommitsYear = 0;
    let avatarUrl = "";
    let name = "";

    // Local Stats
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        try {
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout } = await execAsync('git log --since="midnight" --oneline', { cwd });
            commitsToday = stdout.trim().split('\n').filter(Boolean).length;
            const { stdout: diffOut } = await execAsync('git diff --name-only', { cwd });
            filesChanged = diffOut.trim().split('\n').filter(Boolean).length;
        } catch {}
    }

    // Github Stats
    const cleanNick = nickname.replace('@', '');
    if (cleanNick && cleanNick !== 'Player') {
        try {
            const ghData: any = await new Promise((resolve, reject) => {
                https.get(`https://api.github.com/users/${cleanNick}`, {
                    headers: { 'User-Agent': 'VSCode-ATM-Extension' }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) resolve(JSON.parse(body));
                        else resolve({}); // Graceful fallback
                    });
                }).on('error', reject);
            });

            followers = ghData.followers || 0;
            following = ghData.following || 0;
            if (ghData.bio) bio = ghData.bio;
            if (ghData.name) name = ghData.name;
            if (ghData.created_at) {
                const createdYear = new Date(ghData.created_at).getFullYear();
                years = Math.max(1, new Date().getFullYear() - createdYear);
            }
            if (ghData.avatar_url) {
                avatarUrl = ghData.avatar_url;
            }
            
            totalCommits = ghData.public_repos ? ghData.public_repos * 15 : 120; // Mock total
            totalCommitsYear = ghData.public_repos ? ghData.public_repos * 5 : 45; // Mock year
            dayStreak = ghData.public_gists ? ghData.public_gists : 0; // Mock streak
        } catch (e) {
            console.error('Failed fetching github stats', e);
        }
    }

    // Read local ATM context active time if possible (we can mock active time here since it's just visual for now)
    // In production, we should call ATMDataProvider.getInstance() to get real activeMinutes.
    let timeLabel = "1h 30m";

    return {
        name,
        followers,
        following,
        bio,
        totalCommits,
        years,
        totalCommitsYear,
        dayStreak,
        commitsToday,
        filesChanged,
        timeLabel,
        avatarUrl
    };
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
  const skeletonCssPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'ui', 'skeleton', 'screenshot.css');
  const iconPath = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor.svg');

  const htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  let skeletonCss = '';
  try {
      skeletonCss = fs.readFileSync(skeletonCssPath, 'utf8');
  } catch (e) {
      console.warn('Skeleton css not found', e);
  }
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
  html = html.replace('</head>', `<style>\n${css}\n${skeletonCss}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.split('{{cursorIcon}}').join(cursorIcon);
  html = html.replace('{{imageTag}}', imageTag);
  html = html.replace('{{userImageUri}}', userImgUri.toString());
  html = html.replace('</body>', `<script src="${appJsUri}"></script></body>`);

  panel.webview.html = html;
}

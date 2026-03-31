import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ATMDataProvider } from '../core/provider';

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
    let bio = "Programming enthusiast.";
    let totalCommitsYear = 0;
    let avatarUrl = "";
    let name = "";
    let heatmapData: number[] = [];

    // --- Real active time + local stats from ATMDataProvider singleton ---
    let timeLabel = "0m";
    try {
        const provider = ATMDataProvider.getInstance() as any;
        const minutes: number = provider.activeMinutesToday ?? 0;
        timeLabel = minutes < 60
            ? `${minutes}m`
            : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        filesChanged = provider.filesEditedToday?.size ?? 0;
    } catch {}

    // Local git commits today
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        try {
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout } = await execAsync('git log --since="midnight" --oneline', { cwd });
            commitsToday = stdout.trim().split('\n').filter(Boolean).length;
        } catch {}
    }

    // --- GitHub User API ---
    const cleanNick = nickname.replace('@', '').trim();
    if (cleanNick && cleanNick !== 'Player' && cleanNick !== 'Atom') {
        // Fetch user profile
        try {
            const ghData: any = await new Promise((resolve, reject) => {
                https.get(`https://api.github.com/users/${cleanNick}`, {
                    headers: {
                        'User-Agent': 'VSCode-ATM-Extension/1.0',
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try { resolve(JSON.parse(body)); } catch { resolve({}); }
                    });
                }).on('error', reject);
            });

            followers  = typeof ghData.followers  === 'number' ? ghData.followers  : 0;
            following  = typeof ghData.following  === 'number' ? ghData.following  : 0;
            if (ghData.bio)        bio       = ghData.bio;
            if (ghData.name)       name      = ghData.name;
            if (ghData.avatar_url) avatarUrl = ghData.avatar_url;
            if (ghData.created_at) {
                const createdYear = new Date(ghData.created_at).getFullYear();
                years = Math.max(1, new Date().getFullYear() - createdYear);
            }
            totalCommits = ghData.public_repos ? ghData.public_repos * 15 : 0;
        } catch (e) {
            console.error('[ATM Screenshot] GitHub API error:', e);
        }

        // --- GitHub Contributions Page → heatmap + yearly total + streak ---
        try {
            const html: string = await new Promise((resolve, reject) => {
                https.get(`https://github.com/users/${cleanNick}/contributions`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; VSCode-ATM-Extension)',
                        'Accept': 'text/html'
                    }
                }, (res) => {
                    let body = '';
                    res.on('data', d => body += d);
                    res.on('end', () => resolve(body));
                }).on('error', reject);
            });

            // Heatmap levels (data-level="0..4")
            const levelMatches = html.match(/data-level="(\d+)"/g);
            if (levelMatches) {
                const levels = levelMatches.map(m => parseInt(m.replace(/\D/g, ''), 10));
                heatmapData = levels.slice(-364);
            }

            // Total contributions in the last year
            const yearlyMatch = html.match(/([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i);
            if (yearlyMatch) {
                totalCommitsYear = parseInt(yearlyMatch[1].replace(/,/g, ''), 10);
            }

            // Current streak: consecutive active days counting backwards from today
            if (heatmapData.length > 0) {
                let streak = 0;
                for (let i = heatmapData.length - 1; i >= 0; i--) {
                    if (heatmapData[i] > 0) { streak++; } else { break; }
                }
                dayStreak = streak;
            }
        } catch (e) {
            console.error('[ATM Screenshot] Contributions fetch error:', e);
        }
    }

    const activeDays = heatmapData.filter(level => level > 0).length;

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
        avatarUrl,
        heatmapData,
        activeDays
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

  const widgetsDir = path.join(extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'screenshot', 'ui', 'widgets');
  const profileWidgetHtml = fs.readFileSync(path.join(widgetsDir, 'profile.html'), 'utf8');
  const heatmapWidgetHtml = fs.readFileSync(path.join(widgetsDir, 'heatmap.html'), 'utf8');
  const todayWidgetHtml = fs.readFileSync(path.join(widgetsDir, 'today.html'), 'utf8');
  const actionsWidgetHtml = fs.readFileSync(path.join(widgetsDir, 'actions.html'), 'utf8');

  let htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
  htmlTemplate = htmlTemplate.replace('{{profileWidget}}', profileWidgetHtml);
  htmlTemplate = htmlTemplate.replace('{{heatmapWidget}}', heatmapWidgetHtml);
  htmlTemplate = htmlTemplate.replace('{{todayWidget}}', todayWidgetHtml);
  htmlTemplate = htmlTemplate.replace('{{actionsWidget}}', actionsWidgetHtml);

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

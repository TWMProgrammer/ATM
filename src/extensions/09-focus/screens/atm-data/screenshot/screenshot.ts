import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { exec } from 'child_process';
import * as util from 'util';
import { ATMDataProvider } from '../core/provider';

const execAsync = util.promisify(exec);

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let currentPayload: { nickname?: string, song?: string | null, pomodoros?: number } = {};

export function openScreenshotPanel(extensionUri: vscode.Uri, payload?: { image?: string, nickname?: string, song?: string | null, pomodoros?: number }, onStateChange?: (isOpen: boolean) => void) {
  if (payload) { currentPayload = { ...currentPayload, ...payload }; }
  
    if (currentPanel) {
        updateScreenshotContent(currentPanel, extensionUri, payload ?? currentPayload);
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
  const iconPathDark = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor.svg');
  const iconPathLight = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'assets', 'cursor-light.svg');
  currentPanel.iconPath = {
    light: iconPathLight,
    dark: iconPathDark
  };

  if (onStateChange) {
    onStateChange(true);
  }

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
      if (onStateChange) {
        onStateChange(false);
      }
    },
    null,
  );

    currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'closePanel':
          if (currentPanel) {
            currentPanel.dispose();
          }
          return;
        case 'saveImage':
          await handleSaveImage(message.data, message.extension || 'jpg');
          return;
        case 'openExternalBrowser':
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          return;
        case 'error':
          vscode.window.showErrorMessage(`Screenshot Error: ${message.text}`);
          return;
        case 'requestData':
          try {
            const data: any = await fetchDashboardData(message.nickname);
            data.song = currentPayload.song;
            data.pomodoros = currentPayload.pomodoros;
            currentPanel?.webview.postMessage({ command: 'updateData', data });
          } catch (e) {
            console.error(e);
          }
          return;
      }
    },
    undefined,
  );

    updateScreenshotContent(currentPanel, extensionUri, payload ?? currentPayload);
}

export async function refreshScreenshotPanelData(payload: { nickname?: string, song?: string | null, pomodoros?: number }) {
    if (payload) { currentPayload = { ...currentPayload, ...payload }; }

    if (!currentPanel) {
        return false;
    }
    
    // Tell webview to show skeletons while we load new data
    currentPanel.webview.postMessage({ command: 'showSkeletons' });
    
    try {
        const nicknameToUse = payload.nickname || currentPayload.nickname || 'username';
        const data: any = await fetchDashboardData(nicknameToUse);
        data.song = currentPayload.song;
        data.pomodoros = currentPayload.pomodoros;
        
        currentPanel.webview.postMessage({ command: 'updateData', data, newNickname: nicknameToUse });
    } catch (e) {
        console.error('Error refreshing screenshot data:', e);
    }

    return true;
}



// Cache to avoid hitting Github API limits on rapid refreshes
const GH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let githubCache: { 
    nickname: string;
    profile: any;
    html: string;
    timestamp: number;
} | null = null;

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
    let heatmapGrid: number[] = []; // Padded grid with -1 for empty slots
    let heatmapMonthPositions: { month: number; col: number }[] = [];

    // --- Real active time + local stats from ATMDataProvider singleton ---
    let timeLabel = "0m";
    try {
        const provider = ATMDataProvider.getInstance();
        timeLabel = provider.getFormattedTime();
        filesChanged = provider.getFilesEditedCount();
        dayStreak = provider.getLocalStreak(); // Local streak — instant, no network
    } catch {}

    // Local git commits today
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        try {
            const cwd = workspaceFolders[0].uri.fsPath;
            const { stdout } = await execAsync('git rev-list --count --since="midnight" HEAD', { cwd });
            commitsToday = parseInt(stdout.trim(), 10) || 0;
        } catch {}
    }

    // --- GitHub User API & Contributions ---
    const cleanNick = nickname.replace('@', '').trim();
    if (cleanNick && cleanNick !== 'username' && cleanNick !== 'Player' && cleanNick !== 'Atom') {
        const fetchProfile = new Promise<any>((resolve, reject) => {
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

        const fetchContributions = ATMDataProvider.getInstance().fetchSharedGitHubContributionsHTML(cleanNick);

        // Check Memory Cache First
        if (githubCache && githubCache.nickname === cleanNick && (Date.now() - githubCache.timestamp < GH_CACHE_TTL)) {
            // Re-use cached data directly
            try {
                await processGithubData(githubCache.profile, githubCache.html);
            } catch (e) {
                console.error('[ATM Screenshot] Cache processing error:', e);
            }
        } else {
            // Fresh Fetch
            try {
                const [ghData, html] = await Promise.all([fetchProfile, fetchContributions]);
                githubCache = {
                    nickname: cleanNick,
                    profile: ghData,
                    html: html,
                    timestamp: Date.now()
                };
                await processGithubData(ghData, html);
            } catch (e) {
                console.error('[ATM Screenshot] Fetch error:', e);
                // If a fresh fetch fails (network/rate-limit), keep UI useful with stale cache.
                if (githubCache && githubCache.nickname === cleanNick) {
                    try {
                        await processGithubData(githubCache.profile, githubCache.html);
                    } catch (cacheErr) {
                        console.error('[ATM Screenshot] Stale cache processing error:', cacheErr);
                    }
                }
            }
        }

        async function processGithubData(ghData: any, html: string) {

            // Profile Data
            followers  = typeof ghData.followers  === 'number' ? ghData.followers  : 0;
            following  = typeof ghData.following  === 'number' ? ghData.following  : 0;
            if (ghData.bio) {
                bio = ghData.bio;
            }
            if (ghData.name) {
                name = ghData.name;
            }
            if (ghData.created_at) {
                const createdYear = new Date(ghData.created_at).getFullYear();
                years = Math.max(1, new Date().getFullYear() - createdYear);
            }


            if (ghData.avatar_url) {
                // Fetch avatar as ArrayBuffer and convert to Base64 to avoid HTML Canvas CORS issues
                try {
                    const avatarBase64 = await new Promise<string>((resolveAvatar, rejectAvatar) => {
                        https.get(ghData.avatar_url, (avatarRes) => {
                            const chunks: any[] = [];
                            avatarRes.on('data', chunk => chunks.push(chunk));
                            avatarRes.on('end', () => {
                                const buffer = Buffer.concat(chunks);
                                resolveAvatar(`data:${avatarRes.headers['content-type']};base64,${buffer.toString('base64')}`);
                            });
                        }).on('error', rejectAvatar);
                    });
                    avatarUrl = avatarBase64;
                } catch {
                    // Fallback to plain URL if base64 conversion fails
                    avatarUrl = ghData.avatar_url;
                }
            }

            // Contributions HTML Data - Parse the full grid structure
            // GitHub's HTML contains <td> elements with data-date and data-level attributes
            // organized in week columns (Sunday through Saturday)
            const dayTagRegex = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;
            let dayMatch;
            const allCells: { date: string; level: number; count: number | null }[] = [];
            while ((dayMatch = dayTagRegex.exec(html)) !== null) {
                const date = dayMatch[1];
                const tag = dayMatch[0];

                const levelMatch = tag.match(/data-level="(\d+)"/i);
                const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

                let count: number | null = null;
                const dataCountMatch = tag.match(/data-count="(\d+)"/i);
                if (dataCountMatch) {
                    count = parseInt(dataCountMatch[1], 10);
                }

                if (count === null) {
                    const ariaMatch = tag.match(/aria-label="([^"]+)"/i);
                    if (ariaMatch && ariaMatch[1]) {
                        const label = ariaMatch[1];
                        const countMatch = label.match(/(\d[\d,]*)\s+contributions?/i);
                        if (countMatch) {
                            count = parseInt(countMatch[1].replace(/,/g, ''), 10);
                        } else if (/no\s+contributions?/i.test(label)) {
                            count = 0;
                        }
                    }
                }

                allCells.push({ date, level, count });
            }

            // Fallback: if <td> matching fails, parse loose attribute patterns
            if (allCells.length === 0) {
                const cellRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d+)"/g;
                let cellMatch;
                while ((cellMatch = cellRegex.exec(html)) !== null) {
                    allCells.push({ date: cellMatch[1], level: parseInt(cellMatch[2], 10), count: null });
                }

                if (allCells.length === 0) {
                    const altRegex = /data-level="(\d+)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
                    let altMatch;
                    while ((altMatch = altRegex.exec(html)) !== null) {
                        allCells.push({ date: altMatch[2], level: parseInt(altMatch[1], 10), count: null });
                    }
                }
            }

            if (allCells.length > 0) {
                // Sort cells chronologically to handle any HTML ordering
                allCells.sort((a, b) => a.date.localeCompare(b.date));
                heatmapData = allCells.map(c => c.level);

                // Preferred source for exact values: per-day contribution counts in aria/data-count.
                const dayCounts = allCells
                    .map(c => c.count)
                    .filter((count): count is number => typeof count === 'number');
                if (dayCounts.length > 0) {
                    totalCommitsYear = dayCounts.reduce((sum, count) => sum + count, 0);
                    totalCommits = dayCounts.slice(-7).reduce((sum, count) => sum + count, 0);
                }

                // Calculate week index for each cell based on the earliest date
                const startDate = new Date(allCells[0].date + 'T00:00:00');
                const startDay = startDate.getDay(); // Day of week of first date (0=Sun)
                // The first week column starts on the Sunday at or before the start date
                const weekStartMs = startDate.getTime() - (startDay * 86400000);

                // Build a map of (weekIndex, dayOfWeek) -> level
                const cellMap = new Map<string, number>();
                let maxWeekIdx = 0;
                for (const cell of allCells) {
                    const cellDate = new Date(cell.date + 'T00:00:00');
                    const daysSinceWeekStart = Math.round((cellDate.getTime() - weekStartMs) / 86400000);
                    const weekIdx = Math.floor(daysSinceWeekStart / 7);
                    const dow = cellDate.getDay();
                    cellMap.set(`${weekIdx}_${dow}`, cell.level);
                    if (weekIdx > maxWeekIdx) { maxWeekIdx = weekIdx; }
                }

                // Calculate month label positions: first week where each month appears
                const monthPositions: { month: number; col: number }[] = [];
                let lastMonth = -1;
                for (const cell of allCells) {
                    const cellDate = new Date(cell.date + 'T00:00:00');
                    const m = cellDate.getMonth();
                    if (m !== lastMonth) {
                        const daysSinceWeekStart = Math.round((cellDate.getTime() - weekStartMs) / 86400000);
                        const weekIdx = Math.floor(daysSinceWeekStart / 7);
                        monthPositions.push({ month: m, col: weekIdx });
                        lastMonth = m;
                    }
                }
                heatmapMonthPositions = monthPositions;

                // Build the full padded grid: totalWeeks × 7 days
                // The grid flows column-first with CSS grid-auto-flow: column
                // So data order is: week0_Sun, week0_Mon, ..., week0_Sat, week1_Sun, ...
                const paddedGrid: number[] = [];
                for (let w = 0; w <= maxWeekIdx; w++) {
                    for (let d = 0; d < 7; d++) {
                        const key = `${w}_${d}`;
                        paddedGrid.push(cellMap.has(key) ? cellMap.get(key)! : -1);
                    }
                }
                heatmapGrid = paddedGrid;
            } else {
                // Final fallback: use simple level matching
                const levelMatches = html.match(/data-level="(\d+)"/g);
                if (levelMatches) {
                    heatmapData = levelMatches.map((m: string) => parseInt(m.replace(/\D/g, ''), 10));
                }
            }

            if (totalCommitsYear === 0) {
                const yearlyPatterns = [
                    /([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i,
                    /([\d,]+)\s+contributions?\s+in\s+\d{4}/i,
                ];
                for (const pattern of yearlyPatterns) {
                    const yearlyMatch = html.match(pattern);
                    if (yearlyMatch && yearlyMatch[1]) {
                        totalCommitsYear = parseInt(yearlyMatch[1].replace(/,/g, ''), 10);
                        break;
                    }
                }
            }

            // Note: dayStreak is already set from provider.getLocalStreak() above.
            // We no longer derive it from GitHub heatmap data (unreliable & overrides local).

            // Fallback for weekly commits when per-day counts are not available.
            if (totalCommits === 0) {
                let weekCommits = 0;
                const tooltips = html.match(/<tool-tip[^>]*>([^<]+)<\/tool-tip>/g);
                if (tooltips) {
                    const last7Days = tooltips.slice(-7);
                    for (const tt of last7Days) {
                        const innerMatch = tt.match(/>(\d[\d,]*)\s+contribution/i);
                        if (innerMatch && innerMatch[1]) {
                            weekCommits += parseInt(innerMatch[1].replace(/,/g, ''), 10);
                        }
                    }
                }
                totalCommits = weekCommits;
            }

        }
    }

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
        heatmapGrid,
        heatmapMonthPositions,
    };
}

async function handleSaveImage(dataBase64: string, ext: string = 'jpg') {
  try {
    const base64Data = dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const now = new Date();
    // Unique ID based on milliseconds and a random string to prevent any overwrite collisions
    const ts = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Automatically determine the Downloads folder
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    // Ensure the auto-generated name correctly reflects the format
    const fileName = `ATM-stats-${ts}.${ext}`;
    
    // Prompt the user for exactly where to save, defaulting to Downloads
    const uri = await vscode.window.showSaveDialog({
      filters: { Images: [ext] },
      defaultUri: vscode.Uri.file(path.join(downloadsDir, fileName)),
    });

    if (uri) {
      const buffer = Buffer.from(base64Data, 'base64');
      await vscode.workspace.fs.writeFile(uri, buffer);
      vscode.window.showInformationMessage('Screenshot saved successfully! 📸');
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
    } else if (currentPayload.nickname) {
        nicknameDisplay = currentPayload.nickname.startsWith('@') ? currentPayload.nickname : `@${currentPayload.nickname}`;
    }

  // Load UI files
  const htmlPath = path.join(extensionUri.fsPath, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'ui', 'index.html');
  const cssPath = path.join(extensionUri.fsPath, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'ui', 'index.css');
  const skeletonCssPath = path.join(extensionUri.fsPath, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'ui', 'skeleton', 'screenshot.css');
  const atmIconPath = vscode.Uri.joinPath(extensionUri, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'assets', 'atm.png');
  const atmIconUri = panel.webview.asWebviewUri(atmIconPath);

  const widgetsDir = path.join(extensionUri.fsPath, 'src', 'extensions', '09-focus', 'screens', 'atm-data', 'screenshot', 'ui', 'widgets');
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

  const imageTag = payload?.image ? `<img src="${payload.image}" alt="Atom Screenshot" />` : '<div style="color: grey; padding: 2rem;">No image captured</div>';

  // Make index.js accessible
  const appJsPath = vscode.Uri.joinPath(extensionUri, 'dist', 'index.js');
  const appJsUri = panel.webview.asWebviewUri(appJsPath);

  const cspSource = panel.webview.cspSource;
  const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob: https:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; font-src ${cspSource} data:; connect-src ${cspSource} data: blob:;">`;

  // Inject content
  let html = htmlTemplate.replace('<head>', `<head>\n${cspMetaTag}`);
  html = html.replace('</head>', `<style>\n${css}\n${skeletonCss}\n</style>\n</head>`);
  html = html.replace('{{nickname}}', nicknameDisplay);
  html = html.replace('{{atmIconUri}}', atmIconUri.toString());
  html = html.replace('{{imageTag}}', imageTag);
  html = html.replace('</body>', `<script src="${appJsUri}"></script></body>`);

  panel.webview.html = html;
}

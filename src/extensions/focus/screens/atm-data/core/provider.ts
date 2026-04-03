import * as vscode from 'vscode';
import * as https from 'https';
import { exec } from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(exec);

export interface ATMStats {
  'stat-time': string;
  'stat-commits': string;
  'stat-files': string;
  'stat-streak': string;
}

export class ATMDataProvider {
  private static instance: ATMDataProvider;
  private context: vscode.ExtensionContext | null = null;
  private webviewView: vscode.WebviewView | null = null;
  private currentNickname: string | null = null;
  
  private activeMinutesToday: number = 0;
  private filesEditedToday: Set<string> = new Set();
  
  private updateInterval: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private disposables: vscode.Disposable[] = [];
  private activityInterval: NodeJS.Timeout | null = null;
  
  // --- Memory Caches to prevent CPU/Network Abuse ---
  private gitCache: { commits: number, timestamp: number } | null = null;
  private ghCache: { data: { commits: number, streak: number }, timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.trackActivity();
  }

  public static getInstance(): ATMDataProvider {
    if (!ATMDataProvider.instance) {
      ATMDataProvider.instance = new ATMDataProvider();
    }
    return ATMDataProvider.instance;
  }

  public init(context: vscode.ExtensionContext) {
    this.context = context;
    context.subscriptions.push({ dispose: () => this.dispose() });
    // Load local stats
    const today = new Date().toDateString();
    const storedDate = this.context.globalState.get<string>('atm_stats_date');
    if (storedDate === today) {
      this.activeMinutesToday = this.context.globalState.get<number>('atm_active_minutes') || 0;
      const files = this.context.globalState.get<string[]>('atm_files_edited') || [];
      this.filesEditedToday = new Set(files);
    } else {
      this.resetDailyStats();
    }
  }

  public setWebview(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Only update automatically every 5 minutes to avoid rate limiting
    this.updateInterval = setInterval(() => this.dispatchUpdate(false), 300000); 

    this.webviewView.onDidDispose(() => {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.webviewView = null;
    });
  }

  public setNickname(nickname: string) {
    this.currentNickname = nickname;
    this.dispatchUpdate(true); // Trigger immediate update with new github stats
  }

  private resetDailyStats() {
    this.activeMinutesToday = 0;
    this.filesEditedToday.clear();
    this.saveLocalStats();
  }

  private saveLocalStats() {
    if (!this.context) {
        return;
    }
    this.context.globalState.update('atm_stats_date', new Date().toDateString());
    this.context.globalState.update('atm_active_minutes', this.activeMinutesToday);
    this.context.globalState.update('atm_files_edited', Array.from(this.filesEditedToday));
  }

  private trackActivity() {
    let saveTimeout: NodeJS.Timeout | null = null;
    
    // Track file edits with a Debouncer to save disk IO
    const docChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.scheme === 'file') {
            this.filesEditedToday.add(e.document.uri.fsPath);
            this.lastActivityTime = Date.now();
            
            if (!saveTimeout) {
                saveTimeout = setTimeout(() => {
                    this.saveLocalStats();
                    saveTimeout = null;
                }, 15000); // 15s debounce
            }
        }
    });
    this.disposables.push(docChangeDisposable);
    
    // Track active time (tick every minute if active in the last 5 minutes)
    this.activityInterval = setInterval(() => {
        if (Date.now() - this.lastActivityTime < 5 * 60 * 1000) {
            this.activeMinutesToday += 1;
            this.saveLocalStats();
            this.dispatchUpdate();
        }
    }, 60000);
  }

  private formatTime(minutes: number): string {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  /** Public accessor for formatted active time string. */
  public getFormattedTime(): string {
    return this.formatTime(this.activeMinutesToday);
  }

  /** Public accessor for count of files edited today. */
  public getFilesEditedCount(): number {
    return this.filesEditedToday.size;
  }

  private async getLocalCommits(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return 0;
    }

    const now = Date.now();
    if (this.gitCache && (now - this.gitCache.timestamp < this.CACHE_TTL_MS)) {
        return this.gitCache.commits;
    }
    
    let totalCount = 0;
    
    for (const folder of workspaceFolders) {
        try {
            const cwd = folder.uri.fsPath;
            // Use rev-list --count to avoid maxBuffer errors in large repos with many commits
            const { stdout } = await execAsync('git rev-list --count --since="midnight" HEAD', { cwd });
            const count = parseInt(stdout.trim(), 10);
            if (!isNaN(count)) {
                totalCount += count;
            }
        } catch {
            // Likely not a git repository or zero valid commits, skip safely
        }
    }
    
    this.gitCache = { commits: totalCount, timestamp: now };
    return totalCount;
  }

  private async fetchGitHubStats(username: string): Promise<{ commits: number, streak: number }> {
    const now = Date.now();
    if (this.ghCache && (now - this.ghCache.timestamp < this.CACHE_TTL_MS)) {
        return this.ghCache.data;
    }

    return new Promise((resolve) => {
      https.get(`https://github.com/users/${username}/contributions`, {
          headers: { 
              'User-Agent': 'Mozilla/5.0 (compatible; VSCode-ATM-Extension)',
              'Accept': 'text/html'
          }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
              resolve({ commits: 0, streak: 0 });
              return;
          }
          try {
             let weekCommits = 0;
             const tooltips = data.match(/<tool-tip[^>]*>([^<]+)<\/tool-tip>/g);
             if (tooltips) {
                 const last7 = tooltips.slice(-7);
                 for (const tt of last7) {
                     const m = tt.match(/>(\d+)\s+contribution/i);
                     if (m?.[1]) { weekCommits += parseInt(m[1], 10); }
                 }
             }

             let streak = 0;
             const levelMatches = data.match(/data-level="(\d+)"/g);
             if (levelMatches) {
                 const levels = levelMatches.map((s: string) => parseInt(s.replace(/\D/g, ''), 10));
                 for (let i = levels.length - 1; i >= 0; i--) {
                     if (levels[i] > 0) { streak++; } else { break; }
                 }
             }

             const result = { commits: weekCommits, streak };
             this.ghCache = { data: result, timestamp: Date.now() };
             resolve(result);
          } catch {
             resolve({ commits: 0, streak: 0 });
          }
        });
      }).on('error', () => resolve({ commits: 0, streak: 0 }));
    });
  }

  public async dispatchUpdate(forceGithubFetch: boolean = true) {
    if (!this.webviewView) {
        return;
    }

    let totalCommits = await this.getLocalCommits();
    let streak = 0;

    if (this.currentNickname && this.currentNickname.trim() !== '' && this.currentNickname !== 'username') {
        if (forceGithubFetch) {
            const ghStats = await this.fetchGitHubStats(this.currentNickname);
            this.context?.globalState.update('atm_last_bg_commits', ghStats.commits);
            this.context?.globalState.update('atm_last_bg_streak', ghStats.streak);
            totalCommits += ghStats.commits;
            streak = ghStats.streak;
        } else {
            const cachedCommits = this.context?.globalState.get<number>('atm_last_bg_commits') || 0;
            const cachedStreak = this.context?.globalState.get<number>('atm_last_bg_streak') || 0;
            totalCommits += cachedCommits;
            streak = cachedStreak;
        }
    }

    const stats: ATMStats = {
      'stat-time': this.formatTime(this.activeMinutesToday),
      'stat-commits': totalCommits.toString(),
      'stat-files': this.filesEditedToday.size.toString(),
      'stat-streak': streak.toString()
    };

    this.webviewView.webview.postMessage({
        type: 'statsUpdate',
        stats
    });
  }

  /** Clean up all intervals and listeners to prevent memory leaks. */
  public dispose() {
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

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
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => this.dispatchUpdate(), 60000); // every minute
    }
  }

  public setNickname(nickname: string) {
    this.currentNickname = nickname;
    this.dispatchUpdate(); // Trigger immediate update with new github stats
  }

  private resetDailyStats() {
    this.activeMinutesToday = 0;
    this.filesEditedToday.clear();
    this.saveLocalStats();
  }

  private saveLocalStats() {
    if (!this.context) return;
    this.context.globalState.update('atm_stats_date', new Date().toDateString());
    this.context.globalState.update('atm_active_minutes', this.activeMinutesToday);
    this.context.globalState.update('atm_files_edited', Array.from(this.filesEditedToday));
  }

  private trackActivity() {
    // Track file edits
    vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.scheme === 'file') {
            this.filesEditedToday.add(e.document.uri.fsPath);
            this.lastActivityTime = Date.now();
            this.saveLocalStats();
        }
    });
    
    // Track active time (tick every minute if active in the last 5 minutes)
    setInterval(() => {
        if (Date.now() - this.lastActivityTime < 5 * 60 * 1000) {
            this.activeMinutesToday += 1;
            this.saveLocalStats();
            this.dispatchUpdate();
        }
    }, 60000);
  }

  private formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  private async getLocalCommits(): Promise<number> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return 0;
    
    try {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const cwd = workspaceFolders[0].uri.fsPath;
      const { stdout } = await execAsync('git log --since="midnight" --oneline', { cwd });
      return stdout.trim().split('\\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  }

  private async fetchGitHubStats(username: string): Promise<{ commits: number, streak: number }> {
    return new Promise((resolve) => {
      https.get(`https://api.github.com/users/${username}`, {
          headers: { 'User-Agent': 'VSCode-ATM-Extension' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
             // Basic fallback using public profile numbers, since true contributions requires GraphQL API
             const parsed = JSON.parse(data);
             // We return public repos as "streak" placeholder and a derived number for commits if real data isn't easily accessible without auth.
             // Ideally we'd hit a contributions endpoint. Let's mock the streak / commits based on public data for the demo, 
             // but keep the architecture ready for a real GraphQL query.
             resolve({ 
                 commits: parsed.public_repos ? parsed.public_repos * 4 : 0, 
                 streak: parsed.public_gists ? parsed.public_gists : 0 
             });
          } catch {
             resolve({ commits: 0, streak: 0 });
          }
        });
      }).on('error', () => resolve({ commits: 0, streak: 0 }));
    });
  }

  public async dispatchUpdate() {
    if (!this.webviewView) return;

    let totalCommits = await this.getLocalCommits();
    let streak = 0;

    if (this.currentNickname && this.currentNickname.trim() !== '' && this.currentNickname !== 'Player') {
        const ghStats = await this.fetchGitHubStats(this.currentNickname);
        totalCommits += ghStats.commits;
        streak = ghStats.streak;
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
}

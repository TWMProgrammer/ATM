import * as vscode from 'vscode';
import { SoundPlayer, SoundPlayerConfig } from './sound-player';

export interface TerminalMonitorConfig {
  enabled: boolean;
  debounceMs: number;
}

export class TerminalMonitor {
  private rateLimitMap: Map<string, number>;
  private config: TerminalMonitorConfig;

  constructor(
    private soundPlayer: SoundPlayer,
    private outputChannel: vscode.OutputChannel
  ) {
    this.rateLimitMap = new Map();
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from VSCode settings
   */
  private loadConfig(): TerminalMonitorConfig {
    const config = vscode.workspace.getConfiguration('terminalSound');
    return {
      enabled: config.get<boolean>('enabled', true),
      debounceMs: config.get<number>('debounceMs', 1500)
    };
  }

  /**
   * Get sound player configuration
   */
  private getSoundConfig(): SoundPlayerConfig {
    const config = vscode.workspace.getConfiguration('terminalSound');
    return {
      customSoundPath: config.get<string>('customSoundPath'),
      volume: config.get<number>('volume', 1.0)
    };
  }

  /**
   * Start monitoring terminal events
   */
  public startMonitoring(): vscode.Disposable {
    this.outputChannel.appendLine('Terminal monitoring started');

    return vscode.window.onDidEndTerminalShellExecution(
      this.handleTerminalEvent.bind(this)
    );
  }

  /**
   * Handle terminal command completion
   */
  private async handleTerminalEvent(event: vscode.TerminalShellExecutionEndEvent): Promise<void> {
    // Reload config in case it changed
    this.config = this.loadConfig();

    // Check if extension is enabled
    if (!this.config.enabled) {
      return;
    }

    const exitCode = event.exitCode;
    this.outputChannel.appendLine(`Terminal command ended. exitCode=${exitCode}`);

    // Check if command failed (non-zero exit code)
    if (typeof exitCode === 'number' && exitCode !== 0) {
      const terminalId = this.getTerminalId(event.terminal);

      // Apply rate limiting per terminal
      if (this.shouldPlaySound(terminalId)) {
        const soundConfig = this.getSoundConfig();
        await this.soundPlayer.playSound(soundConfig);
      } else {
        this.outputChannel.appendLine(`Sound skipped: rate limited for terminal ${terminalId}`);
      }
    }
  }

  /**
   * Get unique terminal identifier
   */
  private getTerminalId(terminal: vscode.Terminal): string {
    // Use terminal name + creation time as unique ID
    return `${terminal.name}-${terminal.creationOptions}`;
  }

  /**
   * Check if sound should play for this terminal (rate limiting)
   */
  private shouldPlaySound(terminalId: string): boolean {
    const now = Date.now();
    const lastPlay = this.rateLimitMap.get(terminalId) || 0;

    if (now - lastPlay < this.config.debounceMs) {
      return false;
    }

    this.rateLimitMap.set(terminalId, now);
    return true;
  }

  /**
   * Cleanup rate limit map for closed terminals
   */
  public dispose(): void {
    this.outputChannel.appendLine('Terminal monitoring stopped');
    this.rateLimitMap.clear();
  }
}

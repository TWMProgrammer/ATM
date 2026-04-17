import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, ChildProcess } from 'child_process';

export interface SoundPlayerConfig {
  customSoundPath?: string;
  volume: number;
}

export class SoundPlayer {
  private isPlaying: boolean = false;
  private currentProcess: ChildProcess | null = null;
  private readonly platform: NodeJS.Platform;
  private failureCount: number = 0;
  private readonly MAX_FAILURES = 5;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {
    this.platform = process.platform;
  }

  /**
   * Play sound with interruption support
   */
  public async playSound(config: SoundPlayerConfig): Promise<void> {
    // Kill previous sound if still playing (interrupt behavior)
    if (this.isPlaying && this.currentProcess) {
      this.outputChannel.appendLine('Interrupting previous sound');
      this.killCurrentProcess();
    }

    // Circuit breaker pattern
    if (this.failureCount >= this.MAX_FAILURES) {
      this.outputChannel.appendLine('Too many failures, playback disabled');
      return;
    }

    const soundPath = this.resolveSoundPath(config.customSoundPath);
    if (!soundPath) {
      this.failureCount++;
      this.outputChannel.appendLine('Playback skipped: no valid sound file was found');
      return;
    }

    const command = this.buildAudioCommand(soundPath);

    this.isPlaying = true;

    try {
      await this.executeAudioCommand(command);
      this.failureCount = 0; // Reset on success
      this.outputChannel.appendLine('Sound played successfully');
    } catch (error) {
      this.failureCount++;
      this.outputChannel.appendLine(`Playback failed: ${error}`);
    } finally {
      this.isPlaying = false;
      this.currentProcess = null;
    }
  }

  /**
   * Kill the current audio process
   */
  private killCurrentProcess(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      try {
        this.currentProcess.kill('SIGTERM');
        this.outputChannel.appendLine('Previous audio process terminated');
      } catch (error) {
        this.outputChannel.appendLine(`Failed to kill process: ${error}`);
      }
    }
  }

  /**
   * Resolve sound file path with validation
   */
  private resolveSoundPath(customPath?: string): string | undefined {
    if (customPath && this.validateSoundPath(customPath)) {
      return customPath;
    }

    if (customPath) {
      const recoveredPath = this.resolveBundledSoundPath(path.basename(customPath));
      if (recoveredPath) {
        this.outputChannel.appendLine(`Recovered bundled sound file: ${recoveredPath}`);
        return recoveredPath;
      }
    }

    const defaultWavPath = this.resolveBundledSoundPath('faah.wav');
    if (defaultWavPath) {
      this.outputChannel.appendLine(`Using WAV file: ${defaultWavPath}`);
      return defaultWavPath;
    }

    const defaultMp3Path = this.resolveBundledSoundPath('faah.mp3');
    if (defaultMp3Path) {
      this.outputChannel.appendLine(`Using MP3 file: ${defaultMp3Path}`);
      return defaultMp3Path;
    }

    this.outputChannel.appendLine('No bundled Terminal Sound file found in expected locations');
    return undefined;
  }

  /**
   * Resolve bundled sound file from known extension locations
   */
  private resolveBundledSoundPath(fileName: string): string | undefined {
    const candidates = [
      path.join(this.context.extensionPath, 'src', 'extensions', 'terminal-sound', 'sound', fileName),
      path.join(this.context.extensionPath, 'dist', 'extensions', 'terminal-sound', 'sound', fileName),
      path.join(this.context.extensionPath, 'dist', 'terminal-sound', 'sound', fileName),
      path.join(this.context.extensionPath, 'sound', fileName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Validate sound file path for security
   */
  private validateSoundPath(soundPath: string): boolean {
    try {
      // Normalize path to prevent traversal
      const normalized = path.normalize(soundPath);

      // Check for directory traversal attempts
      if (normalized.includes('..')) {
        this.outputChannel.appendLine(`Invalid path (traversal): ${soundPath}`);
        return false;
      }

      // Validate file extension
      const ext = path.extname(normalized).toLowerCase();
      const validExts = ['.mp3', '.wav', '.ogg'];
      if (!validExts.includes(ext)) {
        this.outputChannel.appendLine(`Unsupported format: ${ext}`);
        return false;
      }

      // Check file exists
      if (!fs.existsSync(normalized)) {
        this.outputChannel.appendLine(`File not found: ${normalized}`);
        return false;
      }

      return true;
    } catch (error) {
      this.outputChannel.appendLine(`Path validation error: ${error}`);
      return false;
    }
  }

  /**
   * Build platform-specific audio command
   */
  private buildAudioCommand(soundPath: string): string {
    const ext = path.extname(soundPath).toLowerCase();
    
    switch (this.platform) {
      case 'win32':
        // Windows Media.SoundPlayer only supports WAV
        if (ext === '.wav') {
          return `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`;
        } else {
          // Fallback for MP3 on Windows
          return `powershell -c "Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open('${soundPath}'); $player.Play(); Start-Sleep -Seconds 2"`;
        }
      case 'darwin':
        // macOS afplay supports both WAV and MP3
        return `afplay "${soundPath}"`;
      default: // Linux
        // Use aplay for WAV (native ALSA), mpg123 for MP3
        if (ext === '.mp3') {
          return `mpg123 -q "${soundPath}" 2>/dev/null || ffplay -nodisp -autoexit -loglevel quiet "${soundPath}" 2>/dev/null || paplay "${soundPath}"`;
        } else {
          return `aplay -q "${soundPath}" 2>/dev/null || paplay "${soundPath}" 2>/dev/null || ffplay -nodisp -autoexit -loglevel quiet "${soundPath}" 2>/dev/null`;
        }
    }
  }

  /**
   * Execute audio command with error handling
   */
  private executeAudioCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.outputChannel.appendLine(`Executing: ${command}`);
      
      this.currentProcess = exec(command, (error, stdout, stderr) => {
        if (error && !error.killed) {
          // Ignore errors from killed processes
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

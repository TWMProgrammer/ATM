import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export interface SoundPlayerConfig {
  customSoundPath?: string;
  volume: number;
}

export class SoundPlayer {
  private isPlaying: boolean = false;
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
   * Play sound with overlap prevention
   */
  public async playSound(config: SoundPlayerConfig): Promise<void> {
    if (this.isPlaying) {
      this.outputChannel.appendLine('Sound skipped: already playing');
      return;
    }

    // Circuit breaker pattern
    if (this.failureCount >= this.MAX_FAILURES) {
      this.outputChannel.appendLine('Too many failures, playback disabled');
      return;
    }

    const soundPath = this.resolveSoundPath(config.customSoundPath);
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
    }
  }

  /**
   * Resolve sound file path with validation
   */
  private resolveSoundPath(customPath?: string): string {
    if (customPath && this.validateSoundPath(customPath)) {
      return customPath;
    }

    // Try WAV first (better compatibility), then fallback to MP3
    const wavPath = path.join(this.context.extensionPath, 'src', 'extensions', 'faah', 'sound', 'faah.wav');
    if (fs.existsSync(wavPath)) {
      this.outputChannel.appendLine(`Using WAV file: ${wavPath}`);
      return wavPath;
    }
    
    // Fallback to MP3 if WAV doesn't exist
    const mp3Path = path.join(this.context.extensionPath, 'src', 'extensions', 'faah', 'sound', 'faah.mp3');
    this.outputChannel.appendLine(`Using MP3 file: ${mp3Path}`);
    return mp3Path;
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
          return `aplay -q "${soundPath}"`;
        }
    }
  }

  /**
   * Execute audio command with error handling
   */
  private executeAudioCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.outputChannel.appendLine(`Executing: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

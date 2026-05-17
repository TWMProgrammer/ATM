import * as vscode from 'vscode';
import { SoundPlayer } from './core/sound-player';
import { TerminalMonitor } from './core/terminal-monitor';
import { registerCommands } from './ui/commands';

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Terminal Sound');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('=================================');
  outputChannel.appendLine('Terminal Sound Extension Activated');
  outputChannel.appendLine('=================================');

  // Check if Terminal Shell Integration API is available
  if (!vscode.window.onDidEndTerminalShellExecution) {
    const msg = 'Terminal shell integration API unavailable. Please update VS Code and ensure shell integration is enabled.';
    outputChannel.appendLine(`ERROR: ${msg}`);
    vscode.window.showWarningMessage(`Terminal Sound: ${msg}`);
    return;
  }

  try {
    // Initialize sound player
    const soundPlayer = new SoundPlayer(context, outputChannel);
    outputChannel.appendLine('✓ Sound player initialized');

    // Initialize terminal monitor
    const terminalMonitor = new TerminalMonitor(soundPlayer, outputChannel);
    outputChannel.appendLine('✓ Terminal monitor initialized');

    // Start monitoring terminal events
    const monitorDisposable = terminalMonitor.startMonitoring();
    context.subscriptions.push(monitorDisposable);
    outputChannel.appendLine('✓ Terminal monitoring started');

    // Register commands (Test Sound, Toggle)
    registerCommands(context, soundPlayer, outputChannel);
    outputChannel.appendLine('✓ Commands registered');

    // Register cleanup on deactivation
    context.subscriptions.push({
      dispose: () => {
        outputChannel.appendLine('Cleaning up resources...');
        terminalMonitor.dispose();
      }
    });

    outputChannel.appendLine('=================================');
    outputChannel.appendLine('Terminal Sound Extension Ready!');
    outputChannel.appendLine('=================================');
  } catch (error) {
    outputChannel.appendLine(`FATAL ERROR: ${error}`);
    vscode.window.showErrorMessage(`Terminal Sound: Failed to activate - ${error}`);
  }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  // Cleanup is handled by subscriptions
}

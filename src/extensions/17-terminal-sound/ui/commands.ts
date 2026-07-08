import * as vscode from 'vscode';
import { SoundPlayer, SoundPlayerConfig } from '../core/sound-player';

/**
 * Register all VSCode commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  soundPlayer: SoundPlayer,
  outputChannel: vscode.OutputChannel
): void {
  // Test sound command
  const testCommand = vscode.commands.registerCommand(
    'terminalSound.testSound',
    async () => {
      outputChannel.appendLine('Test sound command triggered');
      const config = getSoundConfig();
      await soundPlayer.playSound(config);
      // Notification removed as requested
    }
  );

  // Toggle enable/disable command
  const toggleCommand = vscode.commands.registerCommand(
    'terminalSound.toggle',
    async () => {
      const config = vscode.workspace.getConfiguration('terminalSound');
      const current = config.get<boolean>('enabled', true);
      await config.update('enabled', !current, vscode.ConfigurationTarget.Global);

      const status = !current ? 'Enabled' : 'Disabled';
      vscode.window.showInformationMessage(vscode.l10n.t('Terminal Sound: {0}', status));
      outputChannel.appendLine(`Extension ${status.toLowerCase()} by user`);
    }
  );

  context.subscriptions.push(testCommand, toggleCommand);
  outputChannel.appendLine('Commands registered: terminalSound.testSound, terminalSound.toggle');
}

/**
 * Get sound player configuration from VSCode settings
 */
function getSoundConfig(): SoundPlayerConfig {
  const config = vscode.workspace.getConfiguration('terminalSound');
  return {
    customSoundPath: config.get<string>('customSoundPath'),
    volume: config.get<number>('volume', 1.0)
  };
}

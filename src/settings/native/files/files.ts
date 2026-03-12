import * as vscode from 'vscode';

/**
 * Enables native VS Code file explorer settings.
 */
export async function activateFilesSettings() {
  const explorerConfig = vscode.workspace.getConfiguration('explorer');

  if (explorerConfig.get<boolean>('compactFolders') !== false) {
    await explorerConfig.update(
      'compactFolders',
      false,
      vscode.ConfigurationTarget.Global,
    );
  }
}

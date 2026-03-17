import * as vscode from 'vscode';

/**
 * Configures native VS Code sidebar and activity bar layout.
 * - Sidebar: right
 * - Activity Bar: top
 */
export async function activateSideBarSettings() {
  const workbenchConfig = vscode.workspace.getConfiguration('workbench');

  if (workbenchConfig.get<string>('sideBar.location') !== 'right') {
    await workbenchConfig.update(
      'sideBar.location',
      'right',
      vscode.ConfigurationTarget.Global,
    );
  }

  if (workbenchConfig.get<string>('activityBar.location') !== 'top') {
    await workbenchConfig.update(
      'activityBar.location',
      'top',
      vscode.ConfigurationTarget.Global,
    );
  }
}

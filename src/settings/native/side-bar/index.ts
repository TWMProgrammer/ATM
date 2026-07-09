import * as vscode from 'vscode';

/**
 * Configures native VS Code sidebar and activity bar layout.
 * - Sidebar: right
 * - Activity Bar: top
 */
export async function activateSideBarSettings() {
  const atmConfig = vscode.workspace.getConfiguration('atm.layout');
  const startupMode = atmConfig.get<string>('startupMode', 'none');

  if (startupMode === 'none') {
    return;
  }

  const workbenchConfig = vscode.workspace.getConfiguration('workbench');

  if (startupMode === 'pro') {
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
  } else if (startupMode === 'normal') {
    if (workbenchConfig.get<string>('sideBar.location') !== 'left') {
      await workbenchConfig.update(
        'sideBar.location',
        'left',
        vscode.ConfigurationTarget.Global,
      );
    }

    if (workbenchConfig.get<string>('activityBar.location') !== 'default') {
      await workbenchConfig.update(
        'activityBar.location',
        'default',
        vscode.ConfigurationTarget.Global,
      );
    }
  }
}

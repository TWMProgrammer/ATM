import * as vscode from 'vscode';

/**
 * Restores the saved ATM workspace layout. Pro remains the default for users
 * who have not selected a layout yet.
 */
export async function activateSideBarSettings(context: vscode.ExtensionContext) {
  const workbenchConfig = vscode.workspace.getConfiguration('workbench');
  const layoutMode = context.globalState.get<'normal' | 'pro'>(
    'atm.layoutMode',
    'pro',
  );
  const sideBarLocation = layoutMode === 'pro' ? 'right' : 'left';
  const activityBarLocation = layoutMode === 'pro' ? 'top' : 'default';

  if (workbenchConfig.get<string>('sideBar.location') !== sideBarLocation) {
    await workbenchConfig.update(
      'sideBar.location',
      sideBarLocation,
      vscode.ConfigurationTarget.Global,
    );
  }

  if (workbenchConfig.get<string>('activityBar.location') !== activityBarLocation) {
    await workbenchConfig.update(
      'activityBar.location',
      activityBarLocation,
      vscode.ConfigurationTarget.Global,
    );
  }
}


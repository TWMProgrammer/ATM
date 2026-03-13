import * as vscode from 'vscode';

/**
 * Disables native VS Code breadcrumbs navigation.
 */
export async function activateBreadcrumbsSettings() {
  const breadcrumbsConfig = vscode.workspace.getConfiguration('breadcrumbs');

  if (breadcrumbsConfig.get<boolean>('enabled') !== false) {
    await breadcrumbsConfig.update(
      'enabled',
      false,
      vscode.ConfigurationTarget.Global,
    );
  }
}
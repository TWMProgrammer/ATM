import * as vscode from 'vscode';

export async function activateAutoTagFeatures() {
  const config = vscode.workspace.getConfiguration();

  try {
    // Enable Linked Editing (Native Auto Rename Tag)
    await config.update(
      'editor.linkedEditing',
      true,
      vscode.ConfigurationTarget.Global,
    );

    // Disable auto-closing brackets for Markdown
    const markdownConfig = config.inspect<any>('[markdown]')?.globalValue || {};
    markdownConfig['editor.autoClosingBrackets'] = 'never';
    await config.update(
      '[markdown]',
      markdownConfig,
      vscode.ConfigurationTarget.Global,
    );

    console.log('Auto Tag features activated successfully.');
  } catch (error) {
    console.error('Failed to activate Auto Tag features', error);
  }
}

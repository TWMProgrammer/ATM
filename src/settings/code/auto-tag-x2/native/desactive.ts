import * as vscode from 'vscode';

export async function deactivateAutoTagFeatures() {
  const config = vscode.workspace.getConfiguration();

  try {
    // Restore Linked Editing to default
    await config.update(
      'editor.linkedEditing',
      undefined,
      vscode.ConfigurationTarget.Global,
    );

    // Restore Markdown configuration
    const markdownConfig = config.inspect<any>('[markdown]')?.globalValue || {};
    if (markdownConfig['editor.autoClosingBrackets']) {
      delete markdownConfig['editor.autoClosingBrackets'];

      if (Object.keys(markdownConfig).length === 0) {
        await config.update(
          '[markdown]',
          undefined,
          vscode.ConfigurationTarget.Global,
        );
      } else {
        await config.update(
          '[markdown]',
          markdownConfig,
          vscode.ConfigurationTarget.Global,
        );
      }
    }

    console.log('Auto Tag features deactivated.');
  } catch (error) {
    console.error('Failed to deactivate Auto Tag features', error);
  }
}

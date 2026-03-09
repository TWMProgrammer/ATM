import * as vscode from 'vscode';

export async function deactivateAutoTagFeatures() {
  const config = vscode.workspace.getConfiguration();

  try {
    // Restaura Linked Editing a su valor por defecto o indefinido
    await config.update(
      'editor.linkedEditing',
      undefined,
      vscode.ConfigurationTarget.Global,
    );

    // Restaura la configuración de Markdown borrando 'editor.autoClosingBrackets'
    const markdownConfig = config.inspect<any>('[markdown]')?.globalValue || {};
    if (markdownConfig['editor.autoClosingBrackets']) {
      delete markdownConfig['editor.autoClosingBrackets'];

      // Si el objeto queda vacío, eliminamos la clave [markdown] de esta actualización o lo pasamos modificado
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

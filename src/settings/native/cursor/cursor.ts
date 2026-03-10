import * as vscode from 'vscode';

/**
 * Activa las configuraciones nativas del cursor de VS Code.
 * - Cambia 'editor.cursorBlinking' a 'expand'.
 * - Cambia 'editor.cursorSmoothCaretAnimation' a 'on'.
 */
export async function activateCursorSettings() {
  const config = vscode.workspace.getConfiguration();

  // Configuración para el parpadeo del cursor (Cursor Blinking)
  if (config.get('editor.cursorBlinking') !== 'expand') {
    await config.update(
      'editor.cursorBlinking',
      'expand',
      vscode.ConfigurationTarget.Global,
    );
  }

  // Configuración para la animación suave del cursor (Cursor Smooth Caret Animation)
  if (config.get('editor.cursorSmoothCaretAnimation') !== 'on') {
    await config.update(
      'editor.cursorSmoothCaretAnimation',
      'on',
      vscode.ConfigurationTarget.Global,
    );
  }
}

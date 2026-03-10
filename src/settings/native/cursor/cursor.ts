import * as vscode from 'vscode';

/**
 * Activa las configuraciones nativas del cursor de VS Code.
 * - Cambia 'editor.cursorBlinking' a 'expand'.
 * - Cambia 'editor.cursorSmoothCaretAnimation' a 'on'.
 */
export async function activateCursorSettings() {
  const editorConfig = vscode.workspace.getConfiguration('editor');

  // Configuración para el parpadeo del cursor (Cursor Blinking)
  if (editorConfig.get<string>('cursorBlinking') !== 'expand') {
    await editorConfig.update(
      'cursorBlinking',
      'expand',
      vscode.ConfigurationTarget.Global,
    );
  }

  // Configuración para la animación suave del cursor (Cursor Smooth Caret Animation)
  if (editorConfig.get<string>('cursorSmoothCaretAnimation') !== 'on') {
    await editorConfig.update(
      'cursorSmoothCaretAnimation',
      'on',
      vscode.ConfigurationTarget.Global,
    );
  }
}

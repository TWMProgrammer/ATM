import * as vscode from 'vscode';

/**
 * Enables native VS Code cursor settings for a smoother experience.
 */
export async function activateCursorSettings() {
  const editorConfig = vscode.workspace.getConfiguration('editor');

  if (editorConfig.get<string>('cursorBlinking') !== 'expand') {
    await editorConfig.update(
      'cursorBlinking',
      'expand',
      vscode.ConfigurationTarget.Global,
    );
  }

  if (editorConfig.get<string>('cursorSmoothCaretAnimation') !== 'on') {
    await editorConfig.update(
      'cursorSmoothCaretAnimation',
      'on',
      vscode.ConfigurationTarget.Global,
    );
  }
}

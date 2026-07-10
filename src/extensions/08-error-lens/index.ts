import * as vscode from 'vscode';
import { createDecorationStyles } from './ui/styles';
import { updateDecorationsForEditor } from './core/engine';

export function activateErrorLens(context: vscode.ExtensionContext): void {
  /* =========================================================
   * 🎨 INITIALIZE SETTINGS (UI)
   * ========================================================= */
  const styles = createDecorationStyles();

  /* =========================================================
   * ⏱️ DEBOUNCE & UPDATE
   * Helper function with centralized debounce
   * ========================================================= */
  let diagnosticTimer: NodeJS.Timeout | null = null;
  const DEBOUNCE_MS = 300;

  const triggerUpdate = () => {
    if (diagnosticTimer) {
      clearTimeout(diagnosticTimer);
    }
    diagnosticTimer = setTimeout(() => {
      for (const editor of vscode.window.visibleTextEditors) {
        // one failing editor must not block clearing decorations in the rest
        try {
          updateDecorationsForEditor(editor, styles);
        } catch (err) {
          console.error('[error-lens] Failed to update decorations:', err);
        }
      }
    }, DEBOUNCE_MS);
  };

  /* =========================================================
   * 🔌 REGISTER CORE EVENTS
   * ========================================================= */
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      triggerUpdate();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        triggerUpdate();
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      triggerUpdate();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        triggerUpdate();
      }
    }),
    styles,
  );

  /* =========================================================
   * 🚀 INITIAL RENDER
   * ========================================================= */
  triggerUpdate();
}

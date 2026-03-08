import * as vscode from 'vscode';
import { createDecorationStyles } from './ui/styles';
import { updateDecorationsForEditor } from './core/engine';

export function activateErrorLens(context: vscode.ExtensionContext): void {
  // 1. Inicializar estilos (UI)
  const styles = createDecorationStyles();

  // 2. Función auxiliar para actualizar todos los editores visibles (con Debounce central)
  let diagnosticTimer: NodeJS.Timeout | null = null;
  const DEBOUNCE_MS = 300;

  const triggerUpdate = () => {
    if (diagnosticTimer) {
      clearTimeout(diagnosticTimer);
    }
    diagnosticTimer = setTimeout(() => {
      for (const editor of vscode.window.visibleTextEditors) {
        updateDecorationsForEditor(editor, styles);
      }
    }, DEBOUNCE_MS);
  };

  // 3. Registrar eventos de VS Code (Core)
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
        // Ahora sí usamos un Debounce real mediante el timer global
        triggerUpdate();
      }
    }),
    styles, // Registramos el objeto styles que tiene su propio método `dispose()`
  );

  // 4. Pintado (renderizado inicial)
  triggerUpdate();
}

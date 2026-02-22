import * as vscode from 'vscode';
import { createDecorationStyles } from './ui/styles';
import { updateDecorationsForEditor } from './core/engine';

export function activateErrorLens(context: vscode.ExtensionContext): void {
  // 1. Inicializar estilos (UI)
  const styles = createDecorationStyles();

  // 2. Función auxiliar para actualizar todos los editores visibles
  const updateAllDecorations = () => {
    for (const editor of vscode.window.visibleTextEditors) {
      updateDecorationsForEditor(editor, styles);
    }
  };

  // 3. Registrar eventos de VS Code (Core)
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      updateAllDecorations();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDecorationsForEditor(editor, styles);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      updateAllDecorations();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        // Simple debounce nativo guiado por eventos (al teclear repinta su editor activo)
        updateDecorationsForEditor(editor, styles);
      }
    }),
    styles, // Registramos el objeto styles que tiene su propio método `dispose()`
  );

  // 4. Pintado (renderizado inicial)
  updateAllDecorations();
}

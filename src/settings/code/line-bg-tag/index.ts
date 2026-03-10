import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { DecoratorManager } from './ui/DecoratorManager';
import { IndentEngine } from './core/IndentEngine';

let config: ConfigManager;
let decorator: DecoratorManager;
let engine: IndentEngine;

export function activateLineBgTag(context: vscode.ExtensionContext) {
  config = new ConfigManager();
  decorator = new DecoratorManager(config);
  engine = new IndentEngine(config, decorator);

  // Intentar ejecutar de inmediato en el editor activo
  if (vscode.window.activeTextEditor) {
    engine.triggerUpdateDecorations(vscode.window.activeTextEditor);
  }

  // 1. Escuchar cambios de configuración
  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('indentRainbow')) {
      config.reload();
      decorator.buildDecorations();

      // Actualizar todos los editores visibles inmediatamente
      for (const editor of vscode.window.visibleTextEditors) {
        engine.clearAllDecorations(editor);
        engine.triggerUpdateDecorations(editor);
      }
    }
  });

  // 2. Escuchar cambio de pestaña o editor
  const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      engine.cancelUpdate(); // Prevenir colisión con el editor anterior
      if (editor) {
        engine.triggerUpdateDecorations(editor);
      }
    },
  );

  // 3. Escuchar edición de código
  const onTextChange = vscode.workspace.onDidChangeTextDocument((e) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && e.document.uri === editor.document.uri) {
      engine.triggerUpdateDecorations(editor);
    }
  });

  // 4. EL NÚCLEO DE LA OPTIMIZACIÓN: Solo repintar si el usuario hace scroll para mostrar lo que es invisible.
  const onScroll = vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
    if (e.textEditor === vscode.window.activeTextEditor) {
      engine.triggerUpdateDecorations(e.textEditor);
    }
  });

  // Suscribir eventos al manejador del ciclo de vida de VSCode
  context.subscriptions.push(
    onConfigChange,
    onActiveEditorChange,
    onTextChange,
    onScroll,
  );
}

export function deactivateLineBgTag() {
  if (decorator) {
    decorator.clearDecorations();
  }
}

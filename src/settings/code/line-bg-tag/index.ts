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

  // Render immediately on the active editor
  if (vscode.window.activeTextEditor) {
    engine.triggerUpdateDecorations(vscode.window.activeTextEditor);
  }

  // 1. Configuration changes — full rebuild of decorations
  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('indentRainbow')) {
      config.reload();
      decorator.buildDecorations();

      for (const editor of vscode.window.visibleTextEditors) {
        engine.clearAllDecorations(editor);
        engine.triggerUpdateDecorations(editor);
      }
    }
  });

  // 2. Tab/editor switch — cancel pending update to prevent stale renders
  const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      engine.cancelUpdate();
      if (editor) {
        engine.triggerUpdateDecorations(editor);
      }
    },
  );

  // 3. Text edits — re-decorate on content change
  const onTextChange = vscode.workspace.onDidChangeTextDocument((e) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && e.document === editor.document) {
      engine.triggerUpdateDecorations(editor);
    }
  });

  // 4. Scroll — re-decorate newly visible ranges
  const onScroll = vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
    if (e.textEditor === vscode.window.activeTextEditor) {
      engine.triggerUpdateDecorations(e.textEditor);
    }
  });

  context.subscriptions.push(
    onConfigChange,
    onActiveEditorChange,
    onTextChange,
    onScroll,
  );
}

export function deactivateLineBgTag() {
  if (engine) {
    engine.cancelUpdate();
  }
  if (decorator) {
    decorator.disposeAll();
  }
}

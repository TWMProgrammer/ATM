import * as vscode from 'vscode';
import { CommentsCodeController } from './core/controller';

let controller: CommentsCodeController | undefined;

export function activateCommentsCode(context: vscode.ExtensionContext) {
  controller = new CommentsCodeController();

  /* =========================================================
   * 🗺️ MINIMAP SECTION HEADERS
   * Automatically support TODO, FIXME, MARK in the minimap
   * and show only the keyword (excluding the rest of the comment)
   * ========================================================= */
  const minimapConfig = vscode.workspace.getConfiguration('editor.minimap');
  const sectionRegex = '^[ \\t]*(?:\\/\\/|#|<!--|;|\\/\\*)[ \\t]*(MARK|TODO|FIXME):';
  minimapConfig.update('sectionHeaderDetectionRegExp', sectionRegex, true).then(undefined, (err) => {
    console.error('[Comments Code] Failed to update minimap regex:', err);
  });

  /* =========================================================
   * 🔄 DEBOUNCE CACHE INVALIDATION
   * Partial cache invalidation + debounced decoration update
   * ========================================================= */
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        controller?.handleContentChanges(event.contentChanges);
        controller?.triggerUpdateDecorations(event.document);
      }
    }),
  );

  /* =========================================================
   * 👁️ ACTIVE EDITOR CHANGES
   * Listen for visible editor switches
   * ========================================================= */
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        controller?.triggerUpdateDecorations(editor.document, true);
      }
    }),
  );

  /* =========================================================
   * 📜 SCROLL UPDATER
   * Separate 50ms debounce to avoid excessive repaints
   * ========================================================= */
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (
        event.textEditor.document === vscode.window.activeTextEditor?.document
      ) {
        controller?.triggerScrollUpdate(event.textEditor.document);
      }
    }),
  );

  /* =========================================================
   * 🔍 GLOBAL ANNOTATIONS LIST
   * Command to manually list all TODOs/FIXMEs
   * ========================================================= */
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsCode.listAnnotations', () => {
      controller?.listAnnotations();
    }),
  );

  /* =========================================================
   * 🚀 INITIAL ACTIVATION
   * Fast-pass update if an editor is already open
   * ========================================================= */
  if (vscode.window.activeTextEditor) {
    controller.triggerUpdateDecorations(
      vscode.window.activeTextEditor.document,
      true,
    );
  }
}

export function deactivateCommentsCode() {
  controller?.dispose();
}

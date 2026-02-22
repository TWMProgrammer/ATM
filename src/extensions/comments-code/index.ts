import * as vscode from 'vscode';
import { CommentsCodeController } from './core/controller';

let controller: CommentsCodeController | undefined;

export function activateCommentsCode(context: vscode.ExtensionContext) {
  controller = new CommentsCodeController();

  // Escuchar cambios de documento para actualizar las decoraciones con debouncing
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        controller?.triggerUpdateDecorations(event.document);
      }
    }),
  );

  // Escuchar cambios de editor visible (cuando cambias de pestaña)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        controller?.triggerUpdateDecorations(editor.document, true);
      }
    }),
  );

  // Escuchar scroll (vital porque el parser usa visibleRanges)
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (
        event.textEditor.document === vscode.window.activeTextEditor?.document
      ) {
        controller?.triggerUpdateDecorations(event.textEditor.document, true);
      }
    }),
  );

  // Comando para listar todos los TODOs/FIXMEs manual (como hacía todo-highlight)
  context.subscriptions.push(
    vscode.commands.registerCommand('commentsCode.listAnnotations', () => {
      controller?.listAnnotations();
    }),
  );

  // Primera pasada si hay un editor abierto
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

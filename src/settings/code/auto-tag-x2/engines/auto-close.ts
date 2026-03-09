import * as vscode from 'vscode';
import { SUPPORTED_LANGUAGES } from '../config';
import { SELF_CLOSING_TAGS } from '../utils/document-utils';

export function registerAutoClose(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    const { document, contentChanges } = event;
    // Salida temprana: Solo se ejecuta si el archivo está en lenguajes soportados (ej. Markdown). ¡0% lag!
    if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
      return;
    }

    if (contentChanges.length === 0) {
      return;
    }

    const change = contentChanges[0];

    // Solo actuamos si el último carácter introducido es ">"
    if (change.text === '>') {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== document) {
        return;
      }

      const position = change.range.start;
      const line = document.lineAt(position.line).text;

      // Evaluamos la línea justo hasta donde se acaba de teclear el ">"
      const textBeforeCursor = line.substring(0, position.character + 1);

      // Expresión regular ultrarrápida para detectar si acabamos de cerrar una etiqueta de apertura
      // Ej: "<div>" o "<span class='x'>"
      const tagMatch = textBeforeCursor.match(
        /<([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?>$/,
      );

      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();

        // Si es un tag que no se cierra (img, br, etc.), ignoramos
        if (SELF_CLOSING_TAGS.has(tagName)) {
          return;
        }

        const closingTag = `</${tagName}>`;
        const insertPosition = new vscode.Position(
          position.line,
          position.character + 1,
        );

        // Desacoplamos la inyección para evitar conflictos de escritura en tiempo real de VS Code
        Promise.resolve().then(() => {
          editor
            .edit(
              (editBuilder) => {
                editBuilder.insert(insertPosition, closingTag);
              },
              { undoStopBefore: false, undoStopAfter: false },
            )
            .then(() => {
              // Devolvemos el cursor al medio de las etiquetas <-- | -->
              const newPosition = insertPosition;
              editor.selection = new vscode.Selection(newPosition, newPosition);
            });
        });
      }
    }
  });

  context.subscriptions.push(disposable);
}

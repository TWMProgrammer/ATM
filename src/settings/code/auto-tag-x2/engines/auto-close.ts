import * as vscode from 'vscode';
import { SUPPORTED_LANGUAGES } from '../utils/config';
import { SELF_CLOSING_TAGS } from '../utils/document-utils';

export function registerAutoClose(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    const { document, contentChanges } = event;

    if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
      return;
    }

    if (contentChanges.length === 0) {
      return;
    }

    const change = contentChanges[0];

    // Check if the character typed is '>'
    if (change.text === '>') {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== document) {
        return;
      }

      const position = change.range.start;
      const line = document.lineAt(position.line).text;

      // Evaluate the line up to where '>' was typed
      const textBeforeCursor = line.substring(0, position.character + 1);

      // Regex to detect if an opening tag was just closed
      const tagMatch = textBeforeCursor.match(
        /<([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?>$/,
      );

      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();

        // Skip self-closing tags
        if (SELF_CLOSING_TAGS.has(tagName)) {
          return;
        }

        const closingTag = `</${tagName}>`;
        const insertPosition = new vscode.Position(
          position.line,
          position.character + 1,
        );

        // Inject the closing tag
        Promise.resolve().then(() => {
          editor
            .edit(
              (editBuilder) => {
                editBuilder.insert(insertPosition, closingTag);
              },
              { undoStopBefore: false, undoStopAfter: false },
            )
            .then(() => {
              // Move cursor inside the tags
              const newPosition = insertPosition;
              editor.selection = new vscode.Selection(newPosition, newPosition);
            });
        });
      }
    }
  });

  context.subscriptions.push(disposable);
}

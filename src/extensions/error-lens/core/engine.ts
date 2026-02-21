import * as vscode from 'vscode';

// Filtro rápido para no aplicar en paneles output o git.
function _shouldExclude(scheme: string): boolean {
  return scheme === 'output' || scheme === 'git' || scheme === 'debug';
}

/**
 * Optimizaciones aplicadas:
 * 1. Uso de Map para O(1).
 * 2. Filtrado para obviar Hint/Info y guardar solo el error más grave (Error gana a Warning).
 * 3. Textos sin renderizado fantasma (margin usado en vez de blank spaces).
 */
export function updateDecorationsForEditor(
  editor: vscode.TextEditor,
  styles: {
    error: vscode.TextEditorDecorationType;
    warning: vscode.TextEditorDecorationType;
  },
): void {
  const document = editor.document;
  if (!document || _shouldExclude(document.uri.scheme)) {
    return;
  }

  const diagnostics = vscode.languages.getDiagnostics(document.uri);

  const errorOptions: vscode.DecorationOptions[] = [];
  const warningOptions: vscode.DecorationOptions[] = [];

  const diagnosticsByLine = new Map<number, vscode.Diagnostic>();

  for (const diagnostic of diagnostics) {
    // Rendimiento extremo: Cortar y abandonar todo lo que sea Info(2) o Hint(3)
    if (diagnostic.severity > vscode.DiagnosticSeverity.Warning) {
      continue;
    }

    const line = diagnostic.range.start.line;
    const existing = diagnosticsByLine.get(line);

    // Solo permitimos decorar si es el más grave (Error gana sobre Warning)
    if (!existing || diagnostic.severity < existing.severity) {
      diagnosticsByLine.set(line, diagnostic);
    }
  }

  for (const [line, diagnostic] of diagnosticsByLine) {
    const text = document.lineAt(line).text;

    // Final de la cadena real para ubicar la decoración
    const endPos = new vscode.Position(line, text.length);
    const range = new vscode.Range(endPos, endPos);

    // Mensaje limpio. .trim() para quitar cualquier espacio inicial o final fantasma.
    // ESTO ELIMINA EL BUG del recuadro opaco apareciendo primero sin texto.
    const message = diagnostic.message.replace(/\r?\n/g, ' ').trim();

    // Evitamos renderizar burbujas falsas / vacías
    if (!message) {
      continue;
    }

    const decorationOptions: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: message,
        },
      },
    };

    if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
      errorOptions.push(decorationOptions);
    } else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
      warningOptions.push(decorationOptions);
    }
  }

  editor.setDecorations(styles.error, errorOptions);
  editor.setDecorations(styles.warning, warningOptions);
}

import * as vscode from 'vscode';

// Filtro rápido para no aplicar en paneles output o git.
function _shouldExclude(scheme: string): boolean {
  return scheme === 'output' || scheme === 'git' || scheme === 'debug';
}

/**
 * Optimizaciones aplicadas:
 * 1. Uso de Map para O(1) en búsqueda y asignación, más amigable con memoria que objects iterables viejos.
 * 2. Filtrado en la misma pasada para sólo guardar la severidad máxima por línea (ej: Error gana a Warning).
 * 3. Se adjunta puramente al final de la línea mediante calculo de text.length (sin modificar isWholeLine completo).
 */
export function updateDecorationsForEditor(
  editor: vscode.TextEditor,
  styles: {
    error: vscode.TextEditorDecorationType;
    warning: vscode.TextEditorDecorationType;
    info: vscode.TextEditorDecorationType;
    hint: vscode.TextEditorDecorationType;
  },
): void {
  const document = editor.document;
  if (!document || _shouldExclude(document.uri.scheme)) {
    return;
  }

  const diagnostics = vscode.languages.getDiagnostics(document.uri);

  const errorOptions: vscode.DecorationOptions[] = [];
  const warningOptions: vscode.DecorationOptions[] = [];
  const infoOptions: vscode.DecorationOptions[] = [];
  const hintOptions: vscode.DecorationOptions[] = [];

  // Almacenar solo el peor (menor número en severidad) diagnóstico por línea.
  const diagnosticsByLine = new Map<number, vscode.Diagnostic>();

  for (const diagnostic of diagnostics) {
    const line = diagnostic.range.start.line;
    const existing = diagnosticsByLine.get(line);
    // En VSCode, Error=0, Warning=1, Info=2, Hint=3
    if (!existing || diagnostic.severity < existing.severity) {
      diagnosticsByLine.set(line, diagnostic);
    }
  }

  for (const [line, diagnostic] of diagnosticsByLine) {
    const text = document.lineAt(line).text;

    // Ignorar si la linea esta sola o el documento esta cerrado,
    // pero siempre renderizamos al final de la cadena de texto real.
    const endPos = new vscode.Position(line, text.length);
    const range = new vscode.Range(endPos, endPos);

    // Mensaje limpio en una linea. Un espacio de separación extra visual.
    const message = `  ${diagnostic.message.replace(/\r?\n/g, ' ')}`;

    const decorationOptions: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: message,
        },
      },
    };

    switch (diagnostic.severity) {
      case vscode.DiagnosticSeverity.Error:
        errorOptions.push(decorationOptions);
        break;
      case vscode.DiagnosticSeverity.Warning:
        warningOptions.push(decorationOptions);
        break;
      case vscode.DiagnosticSeverity.Information:
        infoOptions.push(decorationOptions);
        break;
      case vscode.DiagnosticSeverity.Hint:
        hintOptions.push(decorationOptions);
        break;
    }
  }

  editor.setDecorations(styles.error, errorOptions);
  editor.setDecorations(styles.warning, warningOptions);
  editor.setDecorations(styles.info, infoOptions);
  editor.setDecorations(styles.hint, hintOptions);
}

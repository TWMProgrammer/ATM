import * as vscode from 'vscode';

let errorDecorationType: vscode.TextEditorDecorationType;
let warningDecorationType: vscode.TextEditorDecorationType;
let infoDecorationType: vscode.TextEditorDecorationType;
let hintDecorationType: vscode.TextEditorDecorationType;

export function activateErrorLens(context: vscode.ExtensionContext): void {
  // Styles for the "Bubble/Pill" design, fuchsia for error
  // Fixed configuration for extreme performance and "out-of-the-box" experience.
  errorDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff2a6d22', // Fondo translúcido (22 en hex para opacidad baja)
      color: '#ff2a6d', // Fucsia vibrante para el texto
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  warningDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022', // Dorado/Naranja oscuro o translucido
      color: '#ffb300',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  infoDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#00bcd422', // Cian sutil
      color: '#00e5ff',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  hintDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#4caf5022', // Verde sutil
      color: '#69f0ae',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const updateDecorations = () => {
    for (const editor of vscode.window.visibleTextEditors) {
      updateDecorationsForEditor(editor);
    }
  };

  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      updateDecorations();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDecorationsForEditor(editor);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      updateDecorations();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        // Simple debounce nativo guiado por eventos (al teclear repinta su editor activo)
        updateDecorationsForEditor(editor);
      }
    }),
    {
      dispose: () => {
        errorDecorationType.dispose();
        warningDecorationType.dispose();
        infoDecorationType.dispose();
        hintDecorationType.dispose();
      },
    },
  );

  // Pintar inicialmente
  updateDecorations();
}

/**
 * Optimizaciones aplicadas:
 * 1. Uso de Map para O(1) en búsqueda y asignación, más amigable con memoria que objects iterables viejos.
 * 2. Filtrado en la misma pasada para sólo guardar la severidad máxima por línea (ej: Error gana a Warning).
 * 3. Se adjunta puramente al final de la línea mediante calculo de text.length (sin modificar isWholeLine completo).
 */
function updateDecorationsForEditor(editor: vscode.TextEditor): void {
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
    let text = document.lineAt(line).text;

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

  editor.setDecorations(errorDecorationType, errorOptions);
  editor.setDecorations(warningDecorationType, warningOptions);
  editor.setDecorations(infoDecorationType, infoOptions);
  editor.setDecorations(hintDecorationType, hintOptions);
}

// Filtro rápido para no aplicar en paneles output o git.
function _shouldExclude(scheme: string): boolean {
  return scheme === 'output' || scheme === 'git' || scheme === 'debug';
}

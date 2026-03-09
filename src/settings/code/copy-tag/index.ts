import * as vscode from 'vscode';
import { getCopyColors } from './colors';

// ── Globals ──────────────────────────────────────────────────────
let decorationType: vscode.TextEditorDecorationType | undefined;
let clearTimer: NodeJS.Timeout | undefined;

// ── Core feature ──────────────────────────────────────────────────────
export function activateCopyTag(context: vscode.ExtensionContext): void {
  // Configurar colores UI visualmente e instanciar
  updateDecorationType();

  const command = vscode.commands.registerCommand(
    'atm.copyTag.run',
    async () => {
      // 1. Efectuar el copiado nativo original sin alterar el portapapeles ni lógicas de editor
      await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

      const editor = vscode.window.activeTextEditor;
      if (!editor || !decorationType) {
        return;
      }

      const config = vscode.workspace.getConfiguration('atm.copyTag');
      if (!config.get<boolean>('enabled', true)) {
        return;
      }

      const timeout = config.get<number>('timeout', 250);

      // 2. Extraer las líneas o piezas de texto exactas a pintar
      const rangesToHighlight = getHighlightedRanges(editor);
      const originalSelections = editor.selections;
      const hasSelection = !originalSelections.every((s) => s.isEmpty);

      // Ocultamos temporalmente la selección azul de VSCode colapsando los cursores
      if (hasSelection) {
        editor.selections = originalSelections.map(
          (s) => new vscode.Selection(s.active, s.active),
        );
      }

      // 3. Pintar en verde (o el color configurado)
      editor.setDecorations(decorationType, rangesToHighlight);

      // 4. Limpieza y restauración
      if (clearTimer) {
        clearTimeout(clearTimer);
      }
      clearTimer = setTimeout(() => {
        if (vscode.window.activeTextEditor === editor && decorationType) {
          // Remover decoración
          editor.setDecorations(decorationType, []);

          // Restauramos la selección original azul solo si el usuario no movió el cursor
          if (hasSelection) {
            const currentSelections = editor.selections;
            const sameCursor =
              currentSelections.length === originalSelections.length &&
              currentSelections.every((s, i) =>
                s.active.isEqual(originalSelections[i].active),
              );
            if (sameCursor) {
              editor.selections = originalSelections;
            }
          }
        }
      }, timeout);
    },
  );

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('atm.copyTag')) {
      updateDecorationType();
    }
  });

  context.subscriptions.push(command, configListener);
}

export function deactivateCopyTag(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
  }
  if (decorationType) {
    decorationType.dispose();
  }
}

/**
 * Crea o actualiza el recuadro decorativo
 */
function updateDecorationType(): void {
  if (decorationType) {
    decorationType.dispose();
  }

  // Extraer paleta de colores moderna desde nuestro nuevo archivo
  const { bg, fg, border } = getCopyColors();

  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: bg,
    color: fg || undefined,
    borderRadius: '3px', // Diseño moderno y suave sin bordes feos
  });
}

function getHighlightedRanges(editor: vscode.TextEditor): vscode.Range[] {
  let lastSelectionGlobalLine = -1;

  const sorted = [...editor.selections].sort((a, b) => {
    if (a.active.line === b.active.line) {
      return a.active.character - b.active.character;
    }
    return a.active.line - b.active.line;
  });

  const parsed = sorted.map((selection) => {
    if (
      selection.isEmpty &&
      lastSelectionGlobalLine === selection.active.line
    ) {
      return null;
    }
    lastSelectionGlobalLine = selection.active.line;

    if (selection.isEmpty) {
      // Extraemos la línea entera pero incluyendo el salto de línea para que cubra todo el ancho azul
      return editor.document.lineAt(selection.active).rangeIncludingLineBreak;
    }

    return selection;
  });

  return parsed.filter((sel) => sel !== null) as vscode.Range[];
}

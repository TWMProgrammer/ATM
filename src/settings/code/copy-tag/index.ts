import * as vscode from 'vscode';

// ── Globals ──────────────────────────────────────────────────────
let deco: vscode.TextEditorDecorationType | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

let isEnabled = true;
let timeoutDuration = 250;

// ── Core feature ─────────────────────────────────────────────────
export function activateCopyTag(ctx: vscode.ExtensionContext): void {
  updateConfig();

  const cmd = vscode.commands.registerCommand('atm.copyTag.run', async () => {
    // 1. Ejecutar el portapapeles de forma nativa primero para que no haya latencia
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

    const editor = vscode.window.activeTextEditor;
    if (!editor || !deco || !isEnabled) {
      return;
    }

    const ranges = getRanges(editor);
    const saved = editor.selections;
    const hasSelection = !saved.every((s) => s.isEmpty);

    // Ocultar la selección del sistema operativo temporalmente
    if (hasSelection) {
      editor.selections = saved.map(
        (s) => new vscode.Selection(s.active, s.active),
      );
    }

    editor.setDecorations(deco, ranges);

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      // Verificar si el editor sigue activo y existe la decoración
      if (vscode.window.activeTextEditor !== editor || !deco) {
        return;
      }

      editor.setDecorations(deco, []);

      // Restaurar selección si el usuario no ha movido el cursor
      if (hasSelection) {
        const cur = editor.selections;
        if (
          cur.length === saved.length &&
          cur.every((s, i) => s.active.isEqual(saved[i].active))
        ) {
          editor.selections = saved;
        }
      }
    }, timeoutDuration);
  });

  const onCfg = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('atm.copyTag')) {
      updateConfig();
    }
  });

  ctx.subscriptions.push(cmd, onCfg);
}

export function deactivateCopyTag(): void {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  deco?.dispose();
  deco = undefined;
}

// ── Internals ────────────────────────────────────────────────────
function updateConfig(): void {
  const c = vscode.workspace.getConfiguration('atm.copyTag');
  isEnabled = c.get<boolean>('enabled', true);
  timeoutDuration = c.get<number>('timeout', 250);

  const bg = c.get<string>('backgroundColor', 'rgba(45, 212, 191, 0.3)');
  const fg = c.get<string | undefined>('foregroundColor', undefined);

  deco?.dispose();
  deco = vscode.window.createTextEditorDecorationType({
    backgroundColor: bg,
    color: fg || undefined,
    borderRadius: '3px',
  });
}

function getRanges(editor: vscode.TextEditor): vscode.Range[] {
  const sels = editor.selections;
  const sorted = [...sels].sort((a, b) => a.start.compareTo(b.start));

  const out: vscode.Range[] = [];
  let prev = -1;

  for (const s of sorted) {
    if (s.isEmpty) {
      if (s.active.line === prev) {
        continue;
      }
      prev = s.active.line;
      out.push(editor.document.lineAt(s.active).range);
    } else {
      out.push(s as vscode.Range);
    }
  }
  return out;
}

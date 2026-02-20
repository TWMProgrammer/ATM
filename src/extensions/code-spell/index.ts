import * as vscode from 'vscode';
import {
  scheduleDiagnosticsCheck,
  spellDiagnostics,
  clearDiagnostics,
} from './providers/diagnostics';
import { SpellCodeActionProvider } from './providers/codeActions';
import { initDictionary, addWordToDictionary } from './core/dictionary';

export function activateCodeSpell(context: vscode.ExtensionContext) {
  // 1. Initialize custom extension dictionary (10k words + Tech Keywords)
  initDictionary(context);

  // 2. Register Diagnostics Provider (Wavy text underlines)
  context.subscriptions.push(spellDiagnostics);

  // 3. Document/Workspace event hooks
  vscode.workspace.onDidChangeTextDocument(
    (e) => scheduleDiagnosticsCheck(e.document),
    null,
    context.subscriptions,
  );
  vscode.workspace.onDidOpenTextDocument(
    (doc) => scheduleDiagnosticsCheck(doc),
    null,
    context.subscriptions,
  );
  vscode.workspace.onDidCloseTextDocument(
    (doc) => clearDiagnostics(doc),
    null,
    context.subscriptions,
  );

  // Activar de inmediato si hay algun editor abierto al momento de iniciar ATM
  if (vscode.window.activeTextEditor) {
    scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
  }

  // 4. Register CodeActions provider for spelling suggestions
  // Suscribes to read all types of extensions (*)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      '*',
      new SpellCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      },
    ),
  );

  // 5. Code Action trigger command internally
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'atm.code-spell.addWord',
      async (word: string) => {
        if (word) {
          // Save word persistently and to current session RAM
          addWordToDictionary(word, context);

          vscode.window.showInformationMessage(
            `✅ "${word}" fue agregado exitosamente al Diccionario de ATM.`,
          );

          // Force immediate rescan so the wavy error disappears without manual input
          if (vscode.window.activeTextEditor) {
            scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
          }
        }
      },
    ),
  );

  console.log(
    '📝 [ATM] Code-Spell (Corrector Ultra Rapido) Activado Corectamente',
  );
}

export function deactivateCodeSpell() {
  spellDiagnostics.clear();
  console.log('📝 [ATM] Code-Spell Desactivado');
}

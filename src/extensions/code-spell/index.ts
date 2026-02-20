import * as vscode from 'vscode';
import {
  scheduleDiagnosticsCheck,
  spellDiagnostics,
  clearDiagnostics,
} from './providers/diagnostics';
import { SpellCodeActionProvider } from './providers/codeActions';
import {
  initDictionary,
  addWordToUserSettings,
  addWordToWorkspaceSettings,
} from './core/dictionary';

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
      'atm.code-spell.addWordUser',
      async (word: string) => {
        if (word) {
          addWordToUserSettings(word);

          vscode.window.showInformationMessage(
            `✅ "${word}" added to User Settings.`,
          );

          if (vscode.window.activeTextEditor) {
            scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
          }
        }
      },
    ),
    vscode.commands.registerCommand(
      'atm.code-spell.addWordWorkspace',
      async (word: string) => {
        if (word) {
          addWordToWorkspaceSettings(word);

          vscode.window.showInformationMessage(
            `✅ "${word}" added to Workspace Settings.`,
          );

          if (vscode.window.activeTextEditor) {
            scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
          }
        }
      },
    ),
  );

  console.log(
    '📝 [ATM] Code-Spell (Ultra Fast Checker) Activated Successfully',
  );
}

export function deactivateCodeSpell() {
  spellDiagnostics.clear();
  console.log('📝 [ATM] Code-Spell Deactivated');
}

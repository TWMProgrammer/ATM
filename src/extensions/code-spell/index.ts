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
import { SUPPORTED_LANGUAGES } from './core/exclusions';

export function activateCodeSpell(context: vscode.ExtensionContext) {
  /* =========================================================
   * 1️⃣ INITIALIZE DICTIONARY
   * Initialize custom extension dictionary (10k words + Tech Keywords)
   * ========================================================= */
  initDictionary(context);

  /* =========================================================
   * 2️⃣ REGISTER DIAGNOSTICS PROVIDER
   * Wavy text underlines
   * ========================================================= */
  context.subscriptions.push(spellDiagnostics);

  /* =========================================================
   * 3️⃣ EVENT HOOKS
   * Document/Workspace event hooks
   * ========================================================= */
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
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        scheduleDiagnosticsCheck(editor.document);
      }
    },
    null,
    context.subscriptions,
  );

  /* =========================================================
   * ⚡ IMMEDIATE ACTIVATION
   * Activate immediately if there is any open editor when ATM starts
   * ========================================================= */
  if (vscode.window.activeTextEditor) {
    scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
  }

  /* =========================================================
   * 4️⃣ REGISTER CODE ACTIONS PROVIDER
   * Subscribe specifically to languages where spell-checking is useful
   * ========================================================= */
  const documentSelectors = Array.from(SUPPORTED_LANGUAGES).map((lang) => ({
    language: lang,
  }));
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      documentSelectors,
      new SpellCodeActionProvider(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      },
    ),
  );

  /* =========================================================
   * 5️⃣ INTERNAL COMMANDS
   * Code Action trigger command internally
   * ========================================================= */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'atm.code-spell.addWordUser',
      async (word: string) => {
        if (word) {
          await addWordToUserSettings(word);

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
          await addWordToWorkspaceSettings(word);

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

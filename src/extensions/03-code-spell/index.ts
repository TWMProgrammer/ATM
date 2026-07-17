import * as vscode from 'vscode';
import {
  scheduleDiagnosticsCheck,
  spellDiagnostics,
  clearDiagnostics,
  clearAllDiagnostics,
} from './providers/diagnostics';
import { SpellCodeActionProvider } from './providers/codeActions';
import {
  initDictionary,
  addWordToUserSettings,
  addWordToWorkspaceSettings,
} from './core/dictionary';
import { SUPPORTED_LANGUAGES } from './core/exclusions';
import {
  CODE_SPELL_CONFIG_SECTION,
  CODE_SPELL_ENABLED_KEY,
  isCodeSpellEnabled,
  toggleCodeSpell,
} from './core/config';
import { spellDecorationType } from './ui/styles';

function enableCodeSpell(context: vscode.ExtensionContext): void {
  initDictionary(context);
  if (vscode.window.activeTextEditor) {
    scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
  }
}

export function activateCodeSpell(context: vscode.ExtensionContext) {
  /* =========================================================
   * 1️⃣ INITIALIZE DICTIONARY
   * Initialize custom extension dictionary (10k words + Tech Keywords)
   * ========================================================= */
  if (isCodeSpellEnabled()) {
    initDictionary(context);
  }

  /* =========================================================
   * 2️⃣ REGISTER DIAGNOSTICS PROVIDER
   * Wavy text underlines
   * ========================================================= */
  context.subscriptions.push(spellDiagnostics, spellDecorationType);

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
  if (isCodeSpellEnabled() && vscode.window.activeTextEditor) {
    scheduleDiagnosticsCheck(vscode.window.activeTextEditor.document);
  }

  /* =========================================================
   * 4️⃣ REGISTER CODE ACTIONS PROVIDER
   * Subscribe specifically to languages where spell-checking is useful
   * ========================================================= */
  const documentSelectors: vscode.DocumentFilter[] = [
    ...Array.from(SUPPORTED_LANGUAGES).map((lang) => ({
      language: lang,
    })),
    { pattern: '**/package.json' },
  ];
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
    vscode.commands.registerCommand('atm.codeSpell.toggle', async () => {
      const enabled = await toggleCodeSpell();
      vscode.window.setStatusBarMessage(
        `$(check) ATM: Code Spell ${enabled ? 'enabled' : 'disabled'}`,
        1800,
      );
    }),
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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        !event.affectsConfiguration(
          `${CODE_SPELL_CONFIG_SECTION}.${CODE_SPELL_ENABLED_KEY}`,
        )
      ) {
        return;
      }

      if (isCodeSpellEnabled()) {
        enableCodeSpell(context);
      } else {
        clearAllDiagnostics();
      }
    }),
  );

  console.log(
    '📝 [ATM] Code-Spell (Ultra Fast Checker) Activated Successfully',
  );
}

export function deactivateCodeSpell() {
  clearAllDiagnostics();
  console.log('📝 [ATM] Code-Spell Deactivated');
}

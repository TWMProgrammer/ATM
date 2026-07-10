'use strict';

import * as vscode from 'vscode';
import { GoLiveDevStatusBar } from './statusbar';

// ======================================
// GO LIVE (DEV) — ACTIVATION | MARK: ACTIVATE
// ======================================
//
// ATM module 26-27: Activates the unified "Go Live (Dev)" left-side status bar
// pill. Bridges state by wrapping the existing commands so we can observe when
// Go Live / Run Dev start and stop without coupling the modules together.

let combinedBar: GoLiveDevStatusBar | undefined;

/**
 * Public accessor so that 26-go and 27-run-dev can push state updates when
 * their own status bar changes. This avoids the need for onDidExecuteCommand
 * (which does not exist in the VS Code API) while keeping the modules decoupled.
 */
export function getGoLiveDevBar(): GoLiveDevStatusBar | undefined {
  return combinedBar;
}

export function activateGoLiveDev(context: vscode.ExtensionContext): void {
  combinedBar = new GoLiveDevStatusBar();
  const bar = combinedBar;

  // ── Toggle command (idle state click) ────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('atm.goLiveDev.toggle', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: '$(broadcast) Go Live',
            description: 'Start a static live-reload server (HTML/CSS/JS)',
            id: 'go-live',
          },
          {
            label: '$(play) Run Dev',
            description: 'Start the framework dev server (Vite, Next, Astro…)  [Alt+G]',
            id: 'run-dev',
          },
        ],
        {
          placeHolder: 'Choose what to launch',
          ignoreFocusOut: false,
        }
      );
      if (!choice) { return; }
      if (choice.id === 'go-live') {
        void vscode.commands.executeCommand('atm.goLive.start');
      } else {
        void vscode.commands.executeCommand('atm.runDev.start');
      }
    }),

    // ── Configuration: allow hiding the combined pill ───────────────────────
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('atm.goLiveDev.showOnStatusbar')) {
        const show = vscode.workspace
          .getConfiguration('atm.goLiveDev')
          .get<boolean>('showOnStatusbar', true);
        bar.syncVisibility(show);
      }
    }),

    { dispose: () => bar.dispose() }
  );
}

export function deactivateGoLiveDev(): void {
  combinedBar?.dispose();
  combinedBar = undefined;
}

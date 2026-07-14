'use strict';

import * as vscode from 'vscode';
import { RunDevController } from './controller';
import { RunDevStatusBar } from './statusbar';

// ======================================
// RUN DEV — ACTIVATION | MARK: ACTIVATE
// ======================================
//
// ATM module 27-run-dev: detect the project framework (Astro, Next.js, Expo/RN,
// Lynx, Vite, …) and run its own dev script in one keystroke — start (alt+g),
// restart (ctrl+g), with the served URL auto-opened and failures surfaced.

let statusBar: RunDevStatusBar | undefined;
let controller: RunDevController | undefined;

export function activateRunDev(context: vscode.ExtensionContext): void {
  statusBar = new RunDevStatusBar();
  controller = new RunDevController(statusBar);
  const active = controller;

  context.subscriptions.push(
    vscode.commands.registerCommand('atm.runDev.start', (uri?: vscode.Uri) => {
      const fileUri = uri instanceof vscode.Uri ? uri : undefined;
      guard(() => active.start(fileUri));
    }),
    vscode.commands.registerCommand('atm.runDev.restart', () => {
      guard(() => active.restart());
    }),
    vscode.commands.registerCommand('atm.runDev.stop', () => {
      guard(() => active.stop());
    }),
    vscode.commands.registerCommand('atm.runDev.openBrowser', () => {
      guard(() => active.openBrowser());
    }),
    { dispose: () => active.dispose() },
    statusBar
  );
}

function guard(fn: () => Promise<void> | void): void {
  void Promise.resolve()
    .then(fn)
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(vscode.l10n.t('ATM Run Dev failed: {0}', detail));
    });
}

export function deactivateRunDev(): void {
  controller?.dispose();
  controller = undefined;
  statusBar = undefined;
}

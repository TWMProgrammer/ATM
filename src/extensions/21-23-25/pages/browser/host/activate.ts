import * as vscode from 'vscode';
import { killBrowser } from '../core/launcher';
import { disposeAllBrowserPanels, newBrowserTab, openBrowser } from './panel';

// ======================================
// ATM BROWSER — ACTIVATION | MARK: ACTIVATE
// ======================================

export function activateBrowser(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('atm.browser.open', () => {
      guard(() => openBrowser(context));
    }),
    vscode.commands.registerCommand('atm.browser.newTab', () => {
      guard(() => newBrowserTab(context));
    })
  );

}

function guard(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(vscode.l10n.t('Browser failed to open: {0}', detail));
  }
}

export function deactivateBrowser(): void {
  disposeAllBrowserPanels();
  killBrowser();
}

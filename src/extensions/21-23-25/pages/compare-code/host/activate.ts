import * as vscode from 'vscode';
import { closeCompareView, createCompareView, isViewOpen } from './panel';

// ======================================
// COMPARE CODE — ACTIVATION | MARK: ACTIVATE
// ======================================

export function activateCompareCode(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('atm.compareCode.open', () => {
      try {
        if (isViewOpen()) {
          closeCompareView();
        } else {
          createCompareView(context);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(
          vscode.l10n.t('Compare Code failed to open: {0}', detail)
        );
      }
    })
  );
}

export function deactivateCompareCode(): void {
  closeCompareView();
}

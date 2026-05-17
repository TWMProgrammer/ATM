import * as vscode from 'vscode';
import { ScreenshotPanel } from './core/ScreenshotPanel';

export function activateScreenshotCode(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('atm.screenshotCode', () => {
      ScreenshotPanel.createOrShow(context);
    })
  );
}

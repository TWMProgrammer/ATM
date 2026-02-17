import * as vscode from 'vscode';
import { activateExtensions } from './extensions/extensions';

export function activate(context: vscode.ExtensionContext): void {
  console.log('🎉 ATM extension activated');

  // Register all sub-extensions (image-preview, etc.)
  activateExtensions(context);
}

export function deactivate(): void {}

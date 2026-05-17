import * as vscode from 'vscode';
import { ColorBoxProvider } from './core/color-provider';

export function activateColorBox(context: vscode.ExtensionContext) {
  /* =========================================================
   * 🎨 ACTIVATE COLOR BOX EXTENSION
   * High-performance inline color provider
   * ========================================================= */
  console.log(
    'Activating color-box extension with high-performance provider...',
  );

  const colorProvider = new ColorBoxProvider();

  // Register provider globally, ignoring css/scss/json to prevent duplicates
  const selector: vscode.DocumentSelector = [
    { language: 'javascript' },
    { language: 'typescript' },
    { language: 'javascriptreact' },
    { language: 'typescriptreact' },
    { language: 'dart' },
    { language: 'qml' },
  ];

  const providerRegistration = vscode.languages.registerColorProvider(
    selector,
    colorProvider,
  );
  context.subscriptions.push(providerRegistration);

  console.log('color-box extension activated successfully.');
}

export function deactivate() {
  console.log('Deactivating color-box extension.');
}

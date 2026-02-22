import * as vscode from 'vscode';
import { ColorBoxProvider } from './core/color-provider';

export function activateColorBox(context: vscode.ExtensionContext) {
  console.log(
    'Activating color-box extension with high-performance provider...',
  );

  // We instantiate our performant Color Provider
  const colorProvider = new ColorBoxProvider();

  // Register our provider universally.
  // Inside the provider, it will immediately ignore 'css', 'scss', 'json' etc. to prevent duplicate swatches.
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

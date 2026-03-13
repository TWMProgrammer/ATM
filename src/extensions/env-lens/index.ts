import * as vscode from 'vscode';
import { EnvHoverProvider } from './ui/hover-provider';
import { registerEnvDecorations } from './ui/decorations';
import { envParser } from './core/env-parser';

export async function activateEnvLens(context: vscode.ExtensionContext) {
  // 1. Initialize the ENV parser (watches .env files)
  await envParser.initialize(context);

  // 2. Register Hover Provider for JS/TS/MDX files
  const hoverProvider = vscode.languages.registerHoverProvider(
    [
      { language: 'javascript', scheme: 'file' },
      { language: 'typescript', scheme: 'file' },
      { language: 'javascriptreact', scheme: 'file' },
      { language: 'typescriptreact', scheme: 'file' }
    ],
    new EnvHoverProvider()
  );

  context.subscriptions.push(hoverProvider);

  // 3. Register Reveal Command
  const revealCommand = vscode.commands.registerCommand('envLens.revealValue', (key: string) => {
    const value = envParser.getValue(key);
    if (value) {
      vscode.window.showInformationMessage(`Env Lens: ${key} = ${value}`, { modal: false });
    }
  });

  context.subscriptions.push(revealCommand);

  // 4. Register Editor Decorations for .env files
  registerEnvDecorations(context);
}

export function deactivateEnvLens() {
  envParser.dispose();
}

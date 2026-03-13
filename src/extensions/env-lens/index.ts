import * as vscode from 'vscode';
import { EnvHoverProvider } from './ui/hover-provider';
import { getBlurEnabled, registerEnvDecorations, setBlurEnabled } from './ui/decorations';
import { envParser } from './core/env-parser';

export async function activateEnvLens(context: vscode.ExtensionContext) {
  const isEnvEditor = (editor?: vscode.TextEditor): boolean => {
    const fileName = editor?.document.fileName.split(/[\\/]/).pop();
    return fileName === '.env';
  };

  const updateEnvLensContext = (editor?: vscode.TextEditor) => {
    const activeEditor = editor ?? vscode.window.activeTextEditor;
    const isEnvFile = isEnvEditor(activeEditor);

    void vscode.commands.executeCommand('setContext', 'envLens.isEnvFile', isEnvFile);
    void vscode.commands.executeCommand('setContext', 'envLens.blurEnabled', getBlurEnabled());
  };

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

  const disableBlurCommand = vscode.commands.registerCommand('envLens.disableBlur', () => {
    setBlurEnabled(false);
    void vscode.commands.executeCommand('setContext', 'envLens.blurEnabled', false);
  });

  const enableBlurCommand = vscode.commands.registerCommand('envLens.enableBlur', () => {
    setBlurEnabled(true);
    void vscode.commands.executeCommand('setContext', 'envLens.blurEnabled', true);
  });

  context.subscriptions.push(disableBlurCommand, enableBlurCommand);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      // Safety-first: if user leaves .env, always re-enable blur.
      if (!isEnvEditor(editor) && !getBlurEnabled()) {
        setBlurEnabled(true);
      }
      updateEnvLensContext(editor);
    })
  );

  // 4. Register Editor Decorations for .env files
  registerEnvDecorations(context);
  updateEnvLensContext();
}

export function deactivateEnvLens() {
  envParser.dispose();
}

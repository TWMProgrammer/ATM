import * as vscode from 'vscode';
import { EnvHoverProvider } from './ui/hover-provider';
import { getBlurEnabled, registerEnvDecorations, revealKeyTemporarily, setBlurEnabled } from './ui/decorations';
import { envParser } from './core/env-parser';

type RevealPayload = string | { key: string; value?: string };

function getEnvLensConfig() {
  const config = vscode.workspace.getConfiguration('atm.envLens');
  const revealDurationRaw = config.get<number>('revealDurationMs', 4000);
  const revealDurationMs = Number.isFinite(revealDurationRaw)
    ? Math.max(1000, Math.min(15000, Math.round(revealDurationRaw)))
    : 5000;

  return {
    revealDurationMs,
    enableHoverReveal: config.get<boolean>('enableHoverReveal', true),
    ultraSecureMode: config.get<boolean>('ultraSecureMode', false),
    autoEnableBlurOnFocusOut: config.get<boolean>('autoEnableBlurOnFocusOut', true),
  };
}

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
  const revealCommand = vscode.commands.registerCommand('envLens.revealValue', (payload: RevealPayload) => {
    const config = getEnvLensConfig();
    if (config.ultraSecureMode || !config.enableHoverReveal) {
      return;
    }

    const key = typeof payload === 'string' ? payload : payload?.key;
    const valueFromPayload = typeof payload === 'string' ? undefined : payload?.value;
    const value = valueFromPayload ?? (key ? envParser.getValue(key) : undefined);

    if (!key) {
      return;
    }

    if (value) {
      revealKeyTemporarily(key, config.revealDurationMs);
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
      const config = getEnvLensConfig();
      // Safety-first: if user leaves .env, always re-enable blur.
      if (config.autoEnableBlurOnFocusOut && !isEnvEditor(editor) && !getBlurEnabled()) {
        setBlurEnabled(true);
      }
      updateEnvLensContext(editor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('atm.envLens')) {
        return;
      }

      const config = getEnvLensConfig();
      if (config.ultraSecureMode && !getBlurEnabled()) {
        setBlurEnabled(true);
      }

      updateEnvLensContext();
    })
  );

  // 4. Register Editor Decorations for .env files
  registerEnvDecorations(context);
  updateEnvLensContext();
}

export function deactivateEnvLens() {
  envParser.dispose();
}

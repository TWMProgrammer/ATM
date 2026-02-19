import * as vscode from 'vscode';
import { activateExtensions } from './extensions/extensions';
import { deactivateVoiceTts } from './extensions/voice-tts';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('🎉 ATM extension activated');

  // Register all sub-extensions (image-preview, voice-tts, etc.)
  await activateExtensions(context);
}

export function deactivate(): void {
  deactivateVoiceTts();
}

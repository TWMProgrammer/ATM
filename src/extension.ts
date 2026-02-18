import * as vscode from 'vscode';
import { activateExtensions } from './extensions/extensions';
import { deactivateVoiceTts } from './extensions/voice-tts';

export function activate(context: vscode.ExtensionContext): void {
  console.log('🎉 ATM extension activated');

  // Register all sub-extensions (image-preview, voice-tts, etc.)
  activateExtensions(context);
}

export function deactivate(): void {
  deactivateVoiceTts();
}

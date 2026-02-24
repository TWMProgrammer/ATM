import * as vscode from 'vscode';
import { activateExtensions } from './extensions/extensions';
import { deactivateVoiceTts } from './extensions/voice-tts';
import { deactivateCommentsCode } from './extensions/comments-code';
import { deactivateMarkdownSee } from './extensions/markdown-see';

export function activate(context: vscode.ExtensionContext): void {
  console.log('🎉 ATM extension activated');

  // Register all sub-extensions (image-preview, voice-tts, etc.)
  activateExtensions(context);
}

export function deactivate(): void {
  deactivateVoiceTts();
  deactivateCommentsCode();
  deactivateMarkdownSee();
}

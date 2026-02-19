import type * as vscode from 'vscode';
import { activateImagePreview } from './image-preview';
import { activateVoiceTts } from './voice-tts';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
  activateImagePreview(context);
  activateVoiceTts(context).catch((error) => {
    console.error('[voice-tts] Activation error:', error);
  });
}

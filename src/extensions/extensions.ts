import type * as vscode from 'vscode';
import { activateImagePreview } from './image-preview';
import { activateVoiceTts } from './voice-tts';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export async function activateExtensions(context: vscode.ExtensionContext): Promise<void> {
  activateImagePreview(context);
  await activateVoiceTts(context);
}

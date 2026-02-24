import type * as vscode from 'vscode';
import { activateImagePreview } from './image-preview';
import { activateVoiceTts } from './voice-tts';
import { activateCodeSpell } from './code-spell';
import { activateErrorLens } from './error-lens';
import { activateColorBox } from './color-box';
import { activateCommentsCode } from './comments-code';
import { activateMarkdownSee } from './markdown-see';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
  activateImagePreview(context);
  activateVoiceTts(context).catch((error) => {
    console.error('[voice-tts] Activation error:', error);
  });
  activateCodeSpell(context);
  activateErrorLens(context);
  activateColorBox(context);
  activateCommentsCode(context);
  activateMarkdownSee(context);
}

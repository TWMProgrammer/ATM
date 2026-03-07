import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';
import { activateExtensions } from './extensions/extensions';
import { deactivateVoiceTts } from './extensions/voice-tts';
import { deactivateCommentsCode } from './extensions/comments-code';
import { deactivateMarkdownStore } from './extensions/markdown-store';
import { deactivateColorDebugging } from './extensions/color-debugging';
import { taskListPlugin } from './extensions/markdown-text/core/taskListPlugin';
import { mermaidPlugin } from './extensions/markdown-text/core/mermaidPlugin';

/**
 * Returns `{ extendMarkdownIt }` so that VS Code's
 * `markdown.markdownItPlugins` contribution point picks it up.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('🎉 ATM extension activated');

  // Register all sub-extensions (image-preview, voice-tts, etc.)
  activateExtensions(context);

  // Expose markdown-it plugin for the built-in Markdown preview
  return {
    extendMarkdownIt(md: MarkdownIt) {
      md.use(taskListPlugin);
      md.use(mermaidPlugin);
      return md;
    },
  };
}

export async function deactivate(): Promise<void> {
  deactivateVoiceTts();
  deactivateCommentsCode();
  deactivateMarkdownStore();
  await deactivateColorDebugging();
}

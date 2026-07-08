import * as vscode from 'vscode';
import type MarkdownIt from 'markdown-it';
import { activateExtensions } from './extensions/extensions';
import { deactivateSettings } from './settings/settings';
import { deactivateVoiceTts } from './extensions/20-voice-tts';
import { deactivateCommentsCode } from './extensions/06-comments-code';
import { deactivateTranslateDoc } from './extensions/18-translate-doc';
import { deactivateColorDebugging } from './extensions/05-color-debugging';
import { taskListPlugin } from './extensions/12-markdown-md/core/taskListPlugin';
import { mermaidPlugin } from './extensions/12-markdown-md/core/mermaidPlugin';
import { deactivateFocus } from './extensions/09-focus/focus';
import { deactivateLint } from './extensions/02-atm-lint/lint';
import { deactivateGlobalStatusBar } from './extensions/shared/shared';
import { deactivateBracketLynx } from './extensions/22-bracket-lynx';
import { deactivateCompareCode } from './extensions/23-compare-code';
import { deactivateBrowser } from './extensions/25-browser';
import { deactivateGoLive } from './extensions/26-go';
import { deactivateRunDev } from './extensions/27-run-dev';

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
  deactivateGlobalStatusBar();
  deactivateSettings();
  deactivateVoiceTts();
  deactivateCommentsCode();
  deactivateTranslateDoc();
  await deactivateColorDebugging();
  deactivateFocus();
  await deactivateLint();
  deactivateBracketLynx();
  deactivateCompareCode();
  deactivateBrowser();
  await deactivateGoLive();
  deactivateRunDev();
}

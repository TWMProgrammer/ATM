import type * as vscode from 'vscode';
import { activateSettings } from '../settings/settings';
import { activateImagePreview } from './11-image-preview';
import { activateVoiceTts } from './20-voice-tts';
import { activateCodeSpell } from './03-code-spell';
import { activateErrorLens } from './08-error-lens';
import { activateColorBox } from './04-color-box';
import { activateCommentsCode } from './06-comments-code';
import { activateTranslateDoc } from './18-translate-doc';
import { activateMdxPreview } from './13-markdown-mdx';
import { activateGitBetter } from './10-git-better';
import { activateColorDebugging } from './05-color-debugging';
import { activateScreenshotCode } from './14-screenshot-code';
import { activateVersionPackage } from './19-version-package';
import { activateSvgBetter } from './15-svg-better';
import { activateDataId } from './01-ai-data-id';
import { activateEnvLens } from './07-env-lens';
import { activateMarkdownImageIcons } from './12-markdown-md/icons-images';
import { activateFocus } from './09-focus/focus';
import { activateLint } from './02-atm-lint/lint';
import { activateGlobalStatusBar } from './zhared/zhared';
import { activate as activateTerminalSound } from './17-terminal-sound/terminal-sound';
import { activateTailwindFold } from './16-tailwind-css/tailwind-fold';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
  // Inicializamos nuestra barra global de una vez:
  activateGlobalStatusBar(context);

  activateSettings(context);
  activateImagePreview(context);
  activateVoiceTts(context).catch((error) => {
    console.error('[voice-tts] Activation error:', error);
  });
  activateCodeSpell(context);
  activateErrorLens(context);
  activateColorBox(context);
  activateCommentsCode(context);
  activateTranslateDoc(context);
  activateMdxPreview(context);
  activateGitBetter(context);
  activateColorDebugging(context);
  activateScreenshotCode(context);
  activateVersionPackage(context);
  activateSvgBetter(context);
  activateDataId(context);
  activateEnvLens(context);
  activateMarkdownImageIcons(context);
  activateFocus(context);
  activateLint(context);
  activateTerminalSound(context);
  activateTailwindFold(context).catch((error) => {
    console.error('[tailwind-css] Activation error:', error);
  });
}

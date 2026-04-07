import type * as vscode from 'vscode';
import { activateSettings } from '../settings/settings';
import { activateImagePreview } from './image-preview';
import { activateVoiceTts } from './voice-tts';
import { activateCodeSpell } from './code-spell';
import { activateErrorLens } from './error-lens';
import { activateColorBox } from './color-box';
import { activateCommentsCode } from './comments-code';
import { activateTranslateDoc } from './translate-doc';
import { activateMdxPreview } from './markdown-mdx';
import { activateGitBetter } from './git-better';
import { activateColorDebugging } from './color-debugging';
import { activateScreenshotCode } from './screenshot-code';
import { activateVersionPackage } from './version-package';
import { activateSvgBetter } from './svg-better';
import { activateDataId } from './ai-data-id';
import { activateEnvLens } from './env-lens';
import { activateMarkdownImageIcons } from './markdown-md/icons-images';
import { activateFocus } from './focus/focus';
import { activateEslint } from './atm-eslint/eslint';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
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
  activateEslint(context);
}

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
import { activateGlobalStatusBar } from './shared/shared';
import { activate as activateTerminalSound } from './17-terminal-sound/terminal-sound';
import { activateTailwindFold } from './16-tailwind-css/tailwind-fold';
import { activateAtmTranslate } from './21-atm-translate';
import { activateBracketLynx } from './22-bracket-lynx';
import { activateCompareCode } from './23-compare-code';
import { activateNpmRun } from './24-npm-run';
import { activateBrowser } from './25-browser';

/**
 * Runs a synchronous sub-extension activation, isolating failures so one
 * broken extension cannot prevent the rest from registering.
 */
function safeActivate(name: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    console.error(`[${name}] Activation error:`, error);
  }
}

/**
 * Runs an async sub-extension activation, isolating both synchronous throws
 * and promise rejections.
 */
function safeActivateAsync(name: string, fn: () => Promise<unknown>): void {
  try {
    fn().catch((error) => {
      console.error(`[${name}] Activation error:`, error);
    });
  } catch (error) {
    console.error(`[${name}] Activation error:`, error);
  }
}

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
  // Inicializamos nuestra barra global de una vez:
  safeActivate('status-bar', () => activateGlobalStatusBar(context));

  safeActivate('settings', () => activateSettings(context));
  safeActivate('image-preview', () => activateImagePreview(context));
  safeActivateAsync('voice-tts', () => activateVoiceTts(context));
  safeActivate('code-spell', () => activateCodeSpell(context));
  safeActivate('error-lens', () => activateErrorLens(context));
  safeActivate('color-box', () => activateColorBox(context));
  safeActivate('comments-code', () => activateCommentsCode(context));
  safeActivate('translate-doc', () => activateTranslateDoc(context));
  safeActivate('markdown-mdx', () => activateMdxPreview(context));
  safeActivate('git-better', () => activateGitBetter(context));
  safeActivate('color-debugging', () => activateColorDebugging(context));
  safeActivate('screenshot-code', () => activateScreenshotCode(context));
  safeActivate('version-package', () => activateVersionPackage(context));
  safeActivate('svg-better', () => activateSvgBetter(context));
  safeActivate('ai-data-id', () => activateDataId(context));
  safeActivate('env-lens', () => activateEnvLens(context));
  safeActivate('markdown-md', () => activateMarkdownImageIcons(context));
  safeActivate('focus', () => activateFocus(context));
  safeActivate('atm-lint', () => activateLint(context));
  safeActivate('terminal-sound', () => activateTerminalSound(context));
  safeActivate('atm-translate', () => activateAtmTranslate(context));
  safeActivateAsync('tailwind-css', () => activateTailwindFold(context));
  safeActivate('bracket-lynx', () => activateBracketLynx(context));
  safeActivate('compare-code', () => activateCompareCode(context));
  safeActivate('npm-run', () => activateNpmRun(context));
  safeActivate('browser', () => activateBrowser(context));
}

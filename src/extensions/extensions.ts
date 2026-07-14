import * as vscode from 'vscode';
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
import { activateBracketLynx } from './22-bracket-lynx';

import { activateNpmRun } from './24-npm-run';

import { activateGoLiveDev, activateGoLive, activateRunDev } from './26-27';
import { activateAtmFormatter } from './28-atm-formatter';
import { activateCommitEmoji } from './29-commit-emoji';
import { activateBeforeAfter } from './30-before-after';
import { activateIra, activateGitCommands, activateAtmTranslate, activateCompareCode, activateBrowser } from './21-23-25';

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

  const config = vscode.workspace.getConfiguration('atm.modules');

  if (config.get<boolean>('settings.enabled', true)) {
    safeActivate('settings', () => activateSettings(context));
  }
  if (config.get<boolean>('imagePreview.enabled', true)) {
    safeActivate('image-preview', () => activateImagePreview(context));
  }
  if (config.get<boolean>('voiceTts.enabled', true)) {
    safeActivateAsync('voice-tts', () => activateVoiceTts(context));
  }
  if (config.get<boolean>('codeSpell.enabled', true)) {
    safeActivate('code-spell', () => activateCodeSpell(context));
  }
  if (config.get<boolean>('errorLens.enabled', true)) {
    safeActivate('error-lens', () => activateErrorLens(context));
  }
  if (config.get<boolean>('colorBox.enabled', true)) {
    safeActivate('color-box', () => activateColorBox(context));
  }
  if (config.get<boolean>('commentsCode.enabled', true)) {
    safeActivate('comments-code', () => activateCommentsCode(context));
  }
  if (config.get<boolean>('translateDoc.enabled', true)) {
    safeActivate('translate-doc', () => activateTranslateDoc(context));
  }
  if (config.get<boolean>('markdownMdx.enabled', true)) {
    safeActivate('markdown-mdx', () => activateMdxPreview(context));
  }
  if (config.get<boolean>('gitBetter.enabled', true)) {
    safeActivate('git-better', () => activateGitBetter(context));
  }
  if (config.get<boolean>('colorDebugging.enabled', true)) {
    safeActivate('color-debugging', () => activateColorDebugging(context));
  }
  if (config.get<boolean>('screenshotCode.enabled', true)) {
    safeActivate('screenshot-code', () => activateScreenshotCode(context));
  }
  if (config.get<boolean>('versionPackage.enabled', true)) {
    safeActivate('version-package', () => activateVersionPackage(context));
  }
  if (config.get<boolean>('svgBetter.enabled', true)) {
    safeActivate('svg-better', () => activateSvgBetter(context));
  }
  if (config.get<boolean>('aiDataId.enabled', true)) {
    safeActivate('ai-data-id', () => activateDataId(context));
  }
  if (config.get<boolean>('envLens.enabled', true)) {
    safeActivate('env-lens', () => activateEnvLens(context));
  }
  if (config.get<boolean>('markdownMd.enabled', true)) {
    safeActivate('markdown-md', () => activateMarkdownImageIcons(context));
  }
  if (config.get<boolean>('focus.enabled', true)) {
    safeActivate('focus', () => activateFocus(context));
  }
  if (config.get<boolean>('atmLint.enabled', true)) {
    safeActivate('atm-lint', () => activateLint(context));
  }
  if (config.get<boolean>('terminalSound.enabled', true)) {
    safeActivate('terminal-sound', () => activateTerminalSound(context));
  }
  if (config.get<boolean>('atmTranslate.enabled', true)) {
    safeActivate('atm-translate', () => activateAtmTranslate(context));
  }
  if (config.get<boolean>('tailwindCss.enabled', true)) {
    safeActivateAsync('tailwind-css', () => activateTailwindFold(context));
  }
  if (config.get<boolean>('bracketLynx.enabled', true)) {
    safeActivate('bracket-lynx', () => activateBracketLynx(context));
  }
  if (config.get<boolean>('compareCode.enabled', true)) {
    safeActivate('compare-code', () => activateCompareCode(context));
  }
  if (config.get<boolean>('npmRun.enabled', true)) {
    safeActivate('npm-run', () => activateNpmRun(context));
  }
  if (config.get<boolean>('browser.enabled', true)) {
    safeActivate('browser', () => activateBrowser(context));
  }
  if (config.get<boolean>('goLive.enabled', true)) {
    safeActivate('go-live', () => activateGoLive(context));
  }
  if (config.get<boolean>('runDev.enabled', true)) {
    safeActivate('run-dev', () => activateRunDev(context));
  }
  if (config.get<boolean>('goLiveDev.enabled', true)) {
    safeActivate('go-live-dev', () => activateGoLiveDev(context));
  }
  if (config.get<boolean>('atmFormatter.enabled', true)) {
    safeActivate('atm-formatter', () => activateAtmFormatter(context));
  }
  if (config.get<boolean>('ira.enabled', true)) {
    safeActivate('ira', () => activateIra(context));
  }
  if (config.get<boolean>('gitCommands.enabled', true)) {
    safeActivate('git-commands', () => activateGitCommands(context));
  }
  if (config.get<boolean>('commitEmoji.enabled', true)) {
    safeActivate('commit-emoji', () => activateCommitEmoji(context));
  }
  if (config.get<boolean>('beforeAfter.enabled', true)) {
    safeActivate('before-after', () => activateBeforeAfter(context));
  }

  // Automatic reload on configuration change
  let reloadTimeout: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('atm.modules')) {
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
        }
        reloadTimeout = setTimeout(() => {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }, 1000);
      }
    })
  );
}

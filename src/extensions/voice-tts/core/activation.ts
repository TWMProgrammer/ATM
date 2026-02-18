import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  getResourcesBasePath,
  getPiperPath,
  readText,
  stopCurrentPlayback,
} from './core';
import { fixSymlinks } from './installer';
import {
  createStatusBarItems,
  setPlayingState,
  getHasTextSelection,
  getIsPlaying,
  disposeStatusBar,
  showVoiceSelector,
} from '../ui/ui';
import type { VoiceTtsApi } from './types';

function setExecutePermissions(context: vscode.ExtensionContext): void {
  if (os.platform() !== 'linux' && os.platform() !== 'darwin') {
    return;
  }

  try {
    const piperPath = getPiperPath(context);
    if (fs.existsSync(piperPath)) {
      fs.chmodSync(piperPath, 0o755);
    }

    const binDir = path.dirname(piperPath);
    for (const binary of ['espeak-ng', 'piper_phonemize']) {
      const binaryPath = path.join(binDir, binary);
      if (fs.existsSync(binaryPath)) {
        fs.chmodSync(binaryPath, 0o755);
      }
    }
  } catch (error) {
    console.error('[voice-tts] Error setting execute permissions:', error);
  }
}

export function activateVoiceTts(
  context: vscode.ExtensionContext,
): VoiceTtsApi {
  const basePath = getResourcesBasePath(context);

  if (os.platform() === 'linux') {
    const arch = os.arch();
    let archDir = 'linux_x86_64';
    if (arch === 'arm64') {
      archDir = 'linux_aarch64';
    } else if (arch === 'arm') {
      archDir = 'linux_armv7l';
    }

    const binaryDir = path.join(basePath, 'piper', archDir);
    fixSymlinks(binaryDir).catch((error) => {
      console.error('[voice-tts] Failed to fix symbolic links:', error);
    });
  }

  setExecutePermissions(context);
  createStatusBarItems(context);

  const api: VoiceTtsApi = {
    readText: (text: string) => readText(context, text),
    stopPlayback: () => {
      stopCurrentPlayback();
      setPlayingState(false);
    },
    selectVoice: () => showVoiceSelector(context),
    downloadVoice: () => showVoiceSelector(context),
    removeVoice: () => showVoiceSelector(context),
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('atm.voiceTts.selectVoice', () =>
      api.selectVoice(),
    ),

    vscode.commands.registerCommand('atm.voiceTts.togglePlayback', async () => {
      if (getIsPlaying()) {
        api.stopPlayback();
        return;
      }

      if (!getHasTextSelection()) {
        vscode.window.showInformationMessage('SELECT TEXT 📃');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const text = editor.document.getText(editor.selection);
      if (!text) {
        return;
      }

      try {
        setPlayingState(true);
        await api.readText(text);
      } catch (error) {
        vscode.window.showErrorMessage(
          'Error running text-to-speech: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      } finally {
        setPlayingState(false);
      }
    }),
  );

  return api;
}

export function deactivateVoiceTts(): void {
  stopCurrentPlayback();
  disposeStatusBar();
}

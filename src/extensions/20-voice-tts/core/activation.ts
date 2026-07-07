import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { getResourcesBasePath, getPiperPath, CONFIG_SECTION, DEFAULT_VOICE, isPlaying, readText, isVoiceInstalled, stopCurrentPlayback, wasStoppedByUser } from './core';
import { createStatusBarItems, setPlayingState, getIsPlaying, disposeStatusBar, showVoiceSelector } from '../ui/ui';
import { fixSymlinks } from './installer';
import type { VoiceTtsApi } from './types';

async function setExecutePermissions(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (os.platform() !== 'linux' && os.platform() !== 'darwin') {
    return;
  }

  try {
    const piperPath = await getPiperPath(context);

    try {
      await fs.promises.access(piperPath, fs.constants.F_OK);
      await fs.promises.chmod(piperPath, 0o755);
    } catch {
      // File doesn't exist yet, skip
    }

    const binDir = path.dirname(piperPath);
    for (const binary of ['espeak-ng', 'piper_phonemize']) {
      const binaryPath = path.join(binDir, binary);
      try {
        await fs.promises.access(binaryPath, fs.constants.F_OK);
        await fs.promises.chmod(binaryPath, 0o755);
      } catch {
        // Skip if file doesn't exist
      }
    }
  } catch (error) {
    console.error('[voice-tts] Error setting execute permissions:', error);
  }
}

async function ensureVoiceForPlayback(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;

  if (await isVoiceInstalled(context, currentVoice)) {
    return true;
  }

  vscode.window.showInformationMessage(vscode.l10n.t('No voice installed 📥 - Download one.'));

  await showVoiceSelector(context);
  return false;
}

export async function activateVoiceTts(
  context: vscode.ExtensionContext,
): Promise<VoiceTtsApi> {
  const basePath = await getResourcesBasePath(context);

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

  await setExecutePermissions(context);
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

    vscode.commands.registerCommand('atm.voiceTts.togglePlayback', () => 
      runPlayback(context, api)
    ),

    vscode.commands.registerCommand('atm.voiceTts.copyAndRead', () => 
      runPlayback(context, api)
    ),
  );

  return api;
}

let currentlyReadingText = '';

/**
 * Common logic for detecting text and starting/stopping playback
 */
async function runPlayback(
  context: vscode.ExtensionContext,
  api: VoiceTtsApi,
): Promise<void> {
  const hasVoice = await ensureVoiceForPlayback(context);
  if (!hasVoice) {
    if (isPlaying()) {
      api.stopPlayback();
      currentlyReadingText = '';
    }
    return;
  }

  let text = '';
  const originalClipboard = await vscode.env.clipboard.readText();
  const DUMMY_TEXT = '___ATM_TTS_DUMMY_CLIPBOARD___';

  try {
    // 1. Try to capture text from whatever is currently focused (Webview, AI Chat, Editor)
    await vscode.env.clipboard.writeText(DUMMY_TEXT);
    
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newClipboard = await vscode.env.clipboard.readText();
    
    if (newClipboard && newClipboard !== DUMMY_TEXT) {
      const isEmptyLineCopy = (() => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.selection.isEmpty) {
          return false;
        }
        try {
          const currentLineText = editor.document.lineAt(editor.selection.active.line).text;
          return newClipboard.trim() === currentLineText.trim();
        } catch {
          return false;
        }
      })();

      if (!isEmptyLineCopy) {
        text = newClipboard.trim();
      }
    }
    
    try {
      if (originalClipboard) {
        await vscode.env.clipboard.writeText(originalClipboard);
      } else {
        await vscode.env.clipboard.writeText('');
      }
    } catch {}
  } catch (error) {
    console.error('[voice-tts] Clipboard copy approach failed:', error);
  }

  // 2. If no text was actively selected in the focused element, fallback to active editor selection
  if (!text) {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      text = editor.document.getText(editor.selection).trim();
    }
  }

  const isCurrentlyPlaying = isPlaying();

  // 3. Fallback to clipboard ONLY if not playing (avoids preventing stop when deselecting)
  if (!text && !isCurrentlyPlaying && originalClipboard) {
    text = originalClipboard.trim();
  }

  if (isCurrentlyPlaying) {
    if (!text || text === currentlyReadingText) {
      // User requested stop with no new selection OR identical selection
      api.stopPlayback();
      currentlyReadingText = '';
      return;
    } else {
      // User selected NEW text while playing!
      api.stopPlayback();
      currentlyReadingText = '';
      
      // Pause briefly for clean up before starting new playback
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } else {
    // Standard playback start checks
    if (!text) {
      vscode.window.showInformationMessage(vscode.l10n.t('SELECT TEXT 📃'));
      return;
    }
  }

  if (!text) {
    return; // Guarantee it's not empty
  }

  try {
    currentlyReadingText = text;
    setPlayingState(true);
    await api.readText(text);
  } catch (error) {
    if (!wasStoppedByUser()) {
      vscode.window.showErrorMessage(
        'Error running text-to-speech: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  } finally {
    if (currentlyReadingText === text) {
      currentlyReadingText = '';
      setPlayingState(false);
    }
  }
}

export function deactivateVoiceTts(): void {
  stopCurrentPlayback();
  disposeStatusBar();
}

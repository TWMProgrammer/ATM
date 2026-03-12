import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { getResourcesBasePath, getPiperPath, CONFIG_SECTION, DEFAULT_VOICE, isPlaying, readText, isVoiceInstalled, stopCurrentPlayback, stoppedByUser } from './core';
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

  vscode.window.showInformationMessage('No voice installed 📥 - Download one.');

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

/**
 * Common logic for detecting text and starting/stopping playback
 */
async function runPlayback(
  context: vscode.ExtensionContext,
  api: VoiceTtsApi,
): Promise<void> {
  // Use a single source of truth for "playing" state
  if (isPlaying() || getIsPlaying()) {
    api.stopPlayback();
    return;
  }

  const hasVoice = await ensureVoiceForPlayback(context);
  if (!hasVoice) {
    return;
  }

  // 1. Get current editor selection (if any)
  const editor = vscode.window.activeTextEditor;
  const editorText = (editor && !editor.selection.isEmpty) 
    ? editor.document.getText(editor.selection).trim() 
    : '';

  // 2. Try to capture selection from the focused panel (AI Chat, Terminal, Webviews)
  try {
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
  } catch {
    // Ignore error
  }

  const clipboardText = (await vscode.env.clipboard.readText()).trim();
  let text = '';

  // 3. LOGIC:
  // If clipboard has text AND it's different from the editor selection,
  // it means the user has something selected in a Webview/Chat.
  if (clipboardText && clipboardText !== editorText) {
    text = clipboardText;
  } 
  // Otherwise, if the editor has a selection, use that.
  else if (editorText) {
    text = editorText;
  }
  // Fallback: just use whatever is in the clipboard
  else if (clipboardText) {
    text = clipboardText;
  }

  if (!text) {
    vscode.window.showInformationMessage('SELECT TEXT 📃');
    return;
  }

  try {
    setPlayingState(true);
    await api.readText(text);
  } catch (error) {
    // Only show error if it wasn't a manual stop
    if (!stoppedByUser) {
      vscode.window.showErrorMessage(
        'Error running text-to-speech: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  } finally {
    setPlayingState(false);
  }
}

export function deactivateVoiceTts(): void {
  stopCurrentPlayback();
  disposeStatusBar();
}

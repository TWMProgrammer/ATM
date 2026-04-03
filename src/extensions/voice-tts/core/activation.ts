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
  if (isPlaying()) {
    api.stopPlayback();
    return;
  }

  const hasVoice = await ensureVoiceForPlayback(context);
  if (!hasVoice) {
    return;
  }

  let text = '';
  const originalClipboard = await vscode.env.clipboard.readText();
  const DUMMY_TEXT = '___ATM_TTS_DUMMY_CLIPBOARD___';

  try {
    // 1. Try to capture text from whatever is currently focused (Webview, AI Chat, Editor)
    // by using the system Copy command. This ensures the *focused* selection wins over an
    // inactive editor selection. We use a dummy text to see if the copy actually succeeds.
    await vscode.env.clipboard.writeText(DUMMY_TEXT);
    
    // Simulate "Copy" action (this captures from the active UI element)
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    
    // Give the system a brief moment to update the clipboard (Webview IPC takes a few ms)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newClipboard = await vscode.env.clipboard.readText();
    
    // If the clipboard changed from DUMMY_TEXT, it means we successfully copied something new
    if (newClipboard && newClipboard !== DUMMY_TEXT) {
      text = newClipboard.trim();
    }
    
    // Try restoring original clipboard silently so we don't pollute it
    try {
      if (originalClipboard) {
        await vscode.env.clipboard.writeText(originalClipboard);
      } else {
        await vscode.env.clipboard.writeText('');
      }
    } catch {
      // Ignored
    }
  } catch (error) {
    console.error('[voice-tts] Clipboard copy approach failed:', error);
  }

  // 2. If no text was actively selected in the focused element, 
  // fallback to the active editor's selection.
  if (!text) {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      text = editor.document.getText(editor.selection).trim();
    }
  }

  // 3. Fallback to whatever was originally in the clipboard if still no text.
  // This allows users to read text copied from outside VS Code.
  if (!text && originalClipboard) {
    text = originalClipboard.trim();
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
    if (!wasStoppedByUser()) {
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

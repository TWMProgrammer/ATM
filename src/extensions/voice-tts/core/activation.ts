import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  getResourcesBasePath,
  getPiperPath,
  CONFIG_SECTION,
  DEFAULT_VOICE,
  isPlaying,
  readText,
  isVoiceInstalled,
  stopCurrentPlayback,
} from './core';
import { fixSymlinks } from './installer';
import {
  createStatusBarItems,
  setPlayingState,
  getIsPlaying,
  disposeStatusBar,
  showVoiceSelector,
} from '../ui/ui';
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

  vscode.window.showInformationMessage('No voice installed - Download 📥 one.');

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

    vscode.commands.registerCommand('atm.voiceTts.togglePlayback', async () => {
      if (isPlaying() || getIsPlaying()) {
        api.stopPlayback();
        return;
      }

      const hasVoice = await ensureVoiceForPlayback(context);
      if (!hasVoice) {
        return;
      }

      // 1. Save current clipboard to detect changes
      const previousClipboard = await vscode.env.clipboard.readText();

      // 2. Try Ctrl+C from whichever panel has focus
      try {
        await vscode.commands.executeCommand(
          'editor.action.clipboardCopyAction',
        );
      } catch {
        // Command may fail if focus is not on a text editor, that's ok
      }

      let text = '';
      const newClipboard = (await vscode.env.clipboard.readText()).trim();

      // 3. If clipboard changed, use the newly copied text
      if (newClipboard && newClipboard !== previousClipboard.trim()) {
        text = newClipboard;
      }

      // 4. Fallback: editor selection (if clipboard didn't capture anything new)
      if (!text) {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
          text = editor.document.getText(editor.selection);
        }
      }

      // 5. Nothing available
      if (!text) {
        vscode.window.showInformationMessage('SELECT TEXT 📃');
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

    // Shift+Alt+V → copy whatever is selected + read it aloud
    vscode.commands.registerCommand('atm.voiceTts.copyAndRead', async () => {
      if (isPlaying() || getIsPlaying()) {
        api.stopPlayback();
        return;
      }

      const hasVoice = await ensureVoiceForPlayback(context);
      if (!hasVoice) {
        return;
      }

      // 1. Save current clipboard to detect changes
      const previousClipboard = await vscode.env.clipboard.readText();

      // 2. Try Ctrl+C from whichever panel has focus
      try {
        await vscode.commands.executeCommand(
          'editor.action.clipboardCopyAction',
        );
      } catch {
        // Command may fail if focus is not on a text editor, that's ok
      }

      let text = '';
      const newClipboard = (await vscode.env.clipboard.readText()).trim();

      // 3. If clipboard changed, use the newly copied text
      if (newClipboard && newClipboard !== previousClipboard.trim()) {
        text = newClipboard;
      }

      // 4. Fallback: editor selection
      if (!text) {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
          text = editor.document.getText(editor.selection);
        }
      }

      // 5. Nothing available
      if (!text) {
        vscode.window.showInformationMessage('SELECT TEXT 📃');
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

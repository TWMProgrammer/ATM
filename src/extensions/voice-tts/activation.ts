/**
 * Voice TTS extension activation and command registration.
 * Integrates core logic with UI components.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
    getResourcesBasePath,
    getPiperPath,
    fixSymlinks,
    readText,
    stopCurrentPlayback,
    type VoiceTtsApi
} from './core';
import {
    createStatusBarItems,
    setPlayingState,
    getHasTextSelection,
    getIsPlaying,
    disposeStatusBar,
    showVoiceSelector,
    updateVoiceStatusBar
} from './ui';

/**
 * Set execute permissions on Piper binaries (Linux/macOS).
 */
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

/**
 * Activate the Voice TTS extension.
 */
export function activateVoiceTts(context: vscode.ExtensionContext): VoiceTtsApi {
    const basePath = getResourcesBasePath(context);

    // Fix symlinks on Linux
    if (os.platform() === 'linux') {
        fixSymlinks(basePath).catch(error => {
            console.error('[voice-tts] Failed to fix symbolic links:', error);
        });
    }

    // Set execute permissions
    setExecutePermissions(context);

    // Create status bar UI
    createStatusBarItems(context);

    // Create the API
    const api: VoiceTtsApi = {
        readText: (text: string) => readText(context, text),
        stopPlayback: () => {
            stopCurrentPlayback();
            setPlayingState(false);
        },
        selectVoice: () => showVoiceSelector(context),
        downloadVoice: () => showVoiceSelector(context), // Unified panel handles download
        removeVoice: () => showVoiceSelector(context)    // Unified panel handles remove
    };

    // Register commands
    context.subscriptions.push(
        // Voice selector (globe icon click)
        vscode.commands.registerCommand('atm.voiceTts.selectVoice', () => api.selectVoice()),

        // Toggle play/stop (play button click)
        vscode.commands.registerCommand('atm.voiceTts.togglePlayback', async () => {
            if (getIsPlaying()) {
                api.stopPlayback();
                return;
            }

            if (!getHasTextSelection()) {
                vscode.window.showInformationMessage('Select some text to read aloud.');
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }

            const text = editor.document.getText(editor.selection);
            if (!text) { return; }

            try {
                setPlayingState(true);
                await api.readText(text);
            } catch (error) {
                vscode.window.showErrorMessage(
                    'Error running text-to-speech: ' + (error instanceof Error ? error.message : String(error))
                );
            } finally {
                setPlayingState(false);
            }
        })
    );

    return api;
}

/**
 * Deactivate the Voice TTS extension.
 */
export function deactivateVoiceTts(): void {
    stopCurrentPlayback();
}

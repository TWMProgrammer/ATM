/**
 * Voice TTS extension activation and command registration
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
    CONFIG_SECTION,
    DEFAULT_VOICE,
    getResourcesBasePath,
    getPiperPath,
    getVoicesDir,
    fixSymlinks,
    readText,
    stopCurrentPlayback,
    getAvailableVoices,
    getVoiceLabel,
    loadVoicesCatalog,
    getVoiceFilePaths,
    deleteVoiceFiles,
    buildVoiceId,
    downloadFile,
    type VoiceTtsApi,
    type VoicesCatalog
} from './core';

/**
 * Download a new voice from the HuggingFace catalog.
 */
async function downloadVoice(context: vscode.ExtensionContext): Promise<void> {
    try {
        const voicesData = await loadVoicesCatalog(context);
        const languages = Object.keys(voicesData);

        const selectedLanguage = await vscode.window.showQuickPick(languages, {
            placeHolder: 'Select a language',
        });
        if (!selectedLanguage) { return; }

        const langEntry = voicesData[selectedLanguage];
        const voices = Object.keys(langEntry);
        const selectedVoice = await vscode.window.showQuickPick(voices, {
            placeHolder: `Select a voice for ${selectedLanguage}`,
        });
        if (!selectedVoice) { return; }

        const voiceEntry = langEntry[selectedVoice];
        const modelSizes = Object.keys(voiceEntry);
        const selectedSize = await vscode.window.showQuickPick(modelSizes, {
            placeHolder: `Select a model size for ${selectedVoice}`,
        });
        if (!selectedSize) { return; }

        const modelData = voiceEntry[selectedSize];
        const voiceId = buildVoiceId(selectedLanguage, selectedVoice, selectedSize);
        const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);

        // Ensure voices directory exists
        const voicesDir = getVoicesDir(context);
        if (!fs.existsSync(voicesDir)) {
            fs.mkdirSync(voicesDir, { recursive: true });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${voiceId}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading model file...' });
            await downloadFile(modelData.model, modelPath);
            progress.report({ message: 'Downloading config file...', increment: 50 });
            await downloadFile(modelData.config, configPath);
            progress.report({ message: 'Download complete', increment: 50 });
        });

        stopCurrentPlayback();
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
            throw new Error('Downloaded voice files not found or not accessible');
        }

        await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
            'voice',
            voiceId,
            vscode.ConfigurationTarget.Global
        );

        vscode.window.showInformationMessage(`Voice ${voiceId} has been downloaded and set as the current voice.`);
    } catch (error) {
        console.error('[voice-tts] Error downloading voice:', error);
        vscode.window.showErrorMessage('Failed to download voice: ' + (error instanceof Error ? error.message : String(error)));
    }
}

/**
 * Select a voice from locally installed voices.
 */
async function selectVoice(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    if (voices.length === 0) {
        vscode.window.showErrorMessage('No voice models found. Use "ATM Voice TTS: Download Voice" to add one.');
        return;
    }

    const items = voices.map(voice => ({
        label: getVoiceLabel(voice),
        description: voice,
    }));

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a voice for text-to-speech',
    });

    if (selection) {
        await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
            'voice',
            selection.description,
            vscode.ConfigurationTarget.Global
        );
    }
}

/**
 * Remove a locally installed voice.
 */
async function removeVoice(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    if (voices.length === 0) {
        vscode.window.showErrorMessage('No voice models found in the voices directory');
        return;
    }

    const items = voices.map(voice => ({
        label: getVoiceLabel(voice),
        description: voice,
    }));

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a voice to remove',
    });

    if (selection) {
        const voiceId = selection.description;

        try {
            deleteVoiceFiles(context, voiceId);
            vscode.window.showInformationMessage(`Voice ${voiceId} has been removed.`);

            const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
            const currentVoice = config.get<string>('voice');
            if (currentVoice === voiceId) {
                await config.update('voice', DEFAULT_VOICE, vscode.ConfigurationTarget.Global);
            }
        } catch (error) {
            console.error('[voice-tts] Error removing voice:', error);
            vscode.window.showErrorMessage('Failed to remove voice: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}

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

    // Create the API
    const api: VoiceTtsApi = {
        readText: (text: string) => readText(context, text),
        stopPlayback: () => stopCurrentPlayback(),
        selectVoice: () => selectVoice(context),
        downloadVoice: () => downloadVoice(context),
        removeVoice: () => removeVoice(context)
    };

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('atm.voiceTts.selectVoice', () => api.selectVoice()),
        vscode.commands.registerCommand('atm.voiceTts.readAloud', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            
            const text = editor.document.getText(editor.selection);
            if (!text) {
                vscode.window.showInformationMessage('Please select some text to read aloud');
                return;
            }
            
            try {
                await api.readText(text);
            } catch (error) {
                vscode.window.showErrorMessage('Error running text-to-speech: ' + (error instanceof Error ? error.message : String(error)));
            }
        }),
        vscode.commands.registerCommand('atm.voiceTts.stopPlayback', () => api.stopPlayback()),
        vscode.commands.registerCommand('atm.voiceTts.downloadVoice', () => api.downloadVoice()),
        vscode.commands.registerCommand('atm.voiceTts.removeVoice', () => api.removeVoice())
    );

    return api;
}

/**
 * Deactivate the Voice TTS extension.
 */
export function deactivateVoiceTts(): void {
    stopCurrentPlayback();
}

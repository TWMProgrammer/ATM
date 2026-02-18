/**
 * Voice download execution logic.
 * Handles downloading Piper engine + voice model with progress notifications.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import {
    getVoicesDir,
    getVoiceFilePaths,
    loadVoicesCatalog,
    lookupVoice,
    resolveDownloadUrls,
    downloadFile,
    formatBytes,
    stopCurrentPlayback,
    isPiperInstalled,
    installPiper,
    CONFIG_SECTION
} from '../core';
import { updateVoiceStatusBar } from './statusBar';

/**
 * Download a voice by its ID with progress notifications.
 * Also installs the Piper engine on first run.
 */
export async function executeVoiceDownload(
    context: vscode.ExtensionContext,
    voiceId: string
): Promise<void> {
    try {
        // Load catalog to get URLs
        const catalog = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'ATM Voice TTS',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Loading voices catalog...' });
            return await loadVoicesCatalog(context);
        });

        // Look up the voice directly by its key
        const voiceEntry = lookupVoice(catalog, voiceId);
        if (!voiceEntry) {
            vscode.window.showErrorMessage(`Voice "${voiceId}" not found in voices catalog.`);
            return;
        }

        // Resolve download URLs from the files map
        const urls = resolveDownloadUrls(voiceEntry);
        if (!urls) {
            vscode.window.showErrorMessage(`Could not resolve download URLs for "${voiceId}".`);
            return;
        }

        // Ensure voices directory exists
        const voicesDir = getVoicesDir(context);
        if (!fs.existsSync(voicesDir)) {
            fs.mkdirSync(voicesDir, { recursive: true });
        }

        const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);
        const modelSize = formatBytes(urls.modelSizeBytes);

        // Download with real progress (includes Piper engine if needed)
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'ATM Voice TTS — Setup',
            cancellable: false
        }, async (progress) => {
            // Step 1: Install Piper engine if not present
            if (!isPiperInstalled(context)) {
                progress.report({ message: 'Installing Piper TTS engine (first time only)...' });
                await installPiper(context, progress);
                progress.report({ message: 'Piper engine installed!' });
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Step 2: Download voice model
            progress.report({ message: `Downloading voice model... 0% (${modelSize})` });
            await downloadFile(urls.modelUrl, modelPath, (p) => {
                const pct = p.percentage ?? 0;
                const downloaded = formatBytes(p.bytesDownloaded);
                progress.report({
                    message: `Downloading voice... ${pct}% (${downloaded} / ${modelSize})`,
                    increment: pct > 0 ? 1 : 0
                });
            });

            // Step 3: Download config
            progress.report({ message: 'Downloading config...' });
            await downloadFile(urls.configUrl, configPath);
            progress.report({ message: 'Complete!' });
        });

        stopCurrentPlayback();
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verify files
        if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
            throw new Error('Downloaded files not found or not accessible');
        }

        // Set as current voice
        await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
            'voice',
            voiceId,
            vscode.ConfigurationTarget.Global
        );
        updateVoiceStatusBar(context);

        vscode.window.showInformationMessage(
            `Voice "${voiceId}" downloaded and set as current voice.`
        );
    } catch (error) {
        console.error('[voice-tts] Error downloading voice:', error);
        vscode.window.showErrorMessage(
            'Failed to download voice: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}

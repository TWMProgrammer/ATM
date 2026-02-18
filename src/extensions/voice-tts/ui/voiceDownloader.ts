/**
 * Voice download UI with simplified language selection.
 * Only supports EN (US) and ES (MX) preset languages.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import {
    PRESET_LANGUAGES,
    getVoicesDir,
    getVoiceFilePaths,
    isVoiceInstalled,
    loadVoicesCatalog,
    lookupVoice,
    resolveDownloadUrls,
    downloadFile,
    formatBytes,
    stopCurrentPlayback,
    CONFIG_SECTION,
    type PresetLanguage
} from '../core';
import { updateVoiceStatusBar } from './statusBar';

/**
 * Show the download voice flow with preset languages (EN_US, ES_MX).
 */
export async function showVoiceDownloader(context: vscode.ExtensionContext): Promise<void> {
    // Step 1: Select language
    const languageItems: vscode.QuickPickItem[] = PRESET_LANGUAGES.map(lang => ({
        label: lang.label,
        description: getLanguageStatus(context, lang),
        detail: lang.recommendedVoices.map(v => v.label).join(', ')
    }));

    const selectedLang = await vscode.window.showQuickPick(languageItems, {
        title: '$(cloud-download) Download Voice',
        placeHolder: 'Select a language to download',
    });
    if (!selectedLang) { return; }

    const preset = PRESET_LANGUAGES.find(l => l.label === selectedLang.label);
    if (!preset) { return; }

    // Step 2: Select voice
    const voiceItems: vscode.QuickPickItem[] = preset.recommendedVoices.map(voice => {
        const voiceId = `${preset.catalogKey}-${voice.name}-${voice.quality}`;
        const installed = isVoiceInstalled(context, voiceId);
        return {
            label: `${installed ? '$(check) ' : '$(cloud-download) '}${voice.label}`,
            description: installed ? 'Installed' : voice.quality,
            detail: voice.description,
        };
    });

    const selectedVoice = await vscode.window.showQuickPick(voiceItems, {
        title: `$(cloud-download) Download Voice — ${preset.label}`,
        placeHolder: 'Select a voice to download',
    });
    if (!selectedVoice) { return; }

    // Find the selected preset voice
    const cleanLabel = selectedVoice.label.replace(/\$\([^)]+\)\s*/g, '');
    const voicePreset = preset.recommendedVoices.find(v => v.label === cleanLabel);
    if (!voicePreset) { return; }

    const voiceId = `${preset.catalogKey}-${voicePreset.name}-${voicePreset.quality}`;

    // Check if already installed
    if (isVoiceInstalled(context, voiceId)) {
        const action = await vscode.window.showInformationMessage(
            `"${voicePreset.label}" is already installed. Set as current voice?`,
            'Set as Current',
            'Reinstall',
            'Cancel'
        );
        if (action === 'Set as Current') {
            await setCurrentVoice(context, voiceId);
            return;
        }
        if (action !== 'Reinstall') { return; }
    }

    // Step 3: Download
    await executeDownload(context, voiceId);
}

/**
 * Get a brief status label for a language (how many voices installed).
 */
function getLanguageStatus(context: vscode.ExtensionContext, lang: PresetLanguage): string {
    const installed = lang.recommendedVoices.filter(v => {
        const voiceId = `${lang.catalogKey}-${v.name}-${v.quality}`;
        return isVoiceInstalled(context, voiceId);
    });
    if (installed.length === 0) { return 'Not installed'; }
    if (installed.length === lang.recommendedVoices.length) { return '✓ All installed'; }
    return `${installed.length}/${lang.recommendedVoices.length} installed`;
}

/**
 * Execute the download with progress notification.
 */
async function executeDownload(
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

        // Download with real progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading "${voiceId}" (${modelSize})`,
            cancellable: false
        }, async (progress) => {
            // Download model
            progress.report({ message: 'Downloading model... 0%' });
            await downloadFile(urls.modelUrl, modelPath, (p) => {
                const pct = p.percentage ?? 0;
                const downloaded = formatBytes(p.bytesDownloaded);
                progress.report({ 
                    message: `Downloading model... ${pct}% (${downloaded} / ${modelSize})`,
                    increment: pct > 0 ? 1 : 0
                });
            });

            // Download config
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
        await setCurrentVoice(context, voiceId);

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

/**
 * Set a voice as the current voice and update status bar.
 */
async function setCurrentVoice(context: vscode.ExtensionContext, voiceId: string): Promise<void> {
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
        'voice',
        voiceId,
        vscode.ConfigurationTarget.Global
    );
    updateVoiceStatusBar(context);
}

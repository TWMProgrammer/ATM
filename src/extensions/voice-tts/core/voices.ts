/**
 * Voice catalog and management utilities for Voice TTS extension
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VOICES_JSON_URL, VOICES_DOWNLOAD_BASE_URL } from './config';
import { getVoicesDir } from './paths';
import { downloadFile } from './download';
import type { VoicesCatalog, CatalogVoiceEntry, VoiceDownloadUrls } from './types';

/**
 * Get list of locally available voice models.
 */
export function getAvailableVoices(context: vscode.ExtensionContext): string[] {
    const voicesDir = getVoicesDir(context);

    try {
        if (!fs.existsSync(voicesDir)) {
            return [];
        }
        const files = fs.readdirSync(voicesDir);
        return files
            .filter(file => file.endsWith('.onnx'))
            .map(file => path.basename(file, '.onnx'));
    } catch (error) {
        console.error('[voice-tts] Error reading voices directory:', error);
        return [];
    }
}

/**
 * Format a voice ID into a human-readable label.
 * Example: "en_US-hfc_female-medium" -> "en US - hfc female (medium)"
 */
export function getVoiceLabel(voice: string): string {
    const parts = voice.split('-');
    const locale = parts[0].replace('_', ' ');
    const name = parts[1]?.replace(/_/g, ' ') ?? '';
    const quality = parts[2] ?? '';
    return `${locale} - ${name} (${quality})`;
}

/**
 * Load the voices catalog from local cache or download from HuggingFace.
 */
export async function loadVoicesCatalog(context: vscode.ExtensionContext): Promise<VoicesCatalog> {
    const voicesDir = getVoicesDir(context);
    const voicesJsonPath = path.join(voicesDir, 'voices.json');

    // Try to read from local cache first
    if (fs.existsSync(voicesJsonPath)) {
        try {
            const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
            return JSON.parse(voicesJson) as VoicesCatalog;
        } catch (error) {
            console.error('[voice-tts] Error parsing local voices.json:', error);
        }
    }

    // Download voices.json from HuggingFace
    console.log('[voice-tts] voices.json not found locally, downloading from HuggingFace...');
    
    if (!fs.existsSync(voicesDir)) {
        fs.mkdirSync(voicesDir, { recursive: true });
    }

    try {
        await downloadFile(VOICES_JSON_URL, voicesJsonPath);
        const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
        return JSON.parse(voicesJson) as VoicesCatalog;
    } catch (error) {
        console.error('[voice-tts] Error downloading voices.json:', error);
        throw new Error('Failed to download voices catalog. Check your internet connection and try again.');
    }
}

/**
 * Look up a voice entry in the catalog by voice ID.
 * Voice ID format: "es_MX-ald-medium" (same as catalog key)
 */
export function lookupVoice(catalog: VoicesCatalog, voiceId: string): CatalogVoiceEntry | null {
    return catalog[voiceId] ?? null;
}

/**
 * Resolve download URLs for a voice from its catalog entry.
 * Constructs full HuggingFace URLs from the relative file paths.
 */
export function resolveDownloadUrls(entry: CatalogVoiceEntry): VoiceDownloadUrls | null {
    const files = Object.keys(entry.files);
    const onnxFile = files.find(f => f.endsWith('.onnx') && !f.endsWith('.onnx.json'));
    const configFile = files.find(f => f.endsWith('.onnx.json'));

    if (!onnxFile || !configFile) {
        return null;
    }

    return {
        modelUrl: `${VOICES_DOWNLOAD_BASE_URL}${onnxFile}`,
        configUrl: `${VOICES_DOWNLOAD_BASE_URL}${configFile}`,
        modelSizeBytes: entry.files[onnxFile].size_bytes
    };
}

/**
 * Get the model and config file paths for a voice.
 */
export function getVoiceFilePaths(context: vscode.ExtensionContext, voiceId: string): {
    modelPath: string;
    configPath: string;
} {
    const voicesDir = getVoicesDir(context);
    return {
        modelPath: path.join(voicesDir, `${voiceId}.onnx`),
        configPath: path.join(voicesDir, `${voiceId}.onnx.json`)
    };
}

/**
 * Check if a voice is installed locally.
 */
export function isVoiceInstalled(context: vscode.ExtensionContext, voiceId: string): boolean {
    const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);
    return fs.existsSync(modelPath) && fs.existsSync(configPath);
}

/**
 * Remove a voice from the local storage.
 */
export function deleteVoiceFiles(context: vscode.ExtensionContext, voiceId: string): void {
    const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);
    
    if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
    }
    if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
    }
}

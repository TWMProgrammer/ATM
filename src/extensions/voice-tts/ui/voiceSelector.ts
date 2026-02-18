/**
 * Voice selector QuickPick UI.
 * Shows installed voices with option to download more or remove existing ones.
 * Displays upward from status bar click.
 */

import * as vscode from 'vscode';
import {
    CONFIG_SECTION,
    DEFAULT_VOICE,
    getAvailableVoices,
    getVoiceLabel,
    deleteVoiceFiles,
    isVoiceInstalled
} from '../core';
import { updateVoiceStatusBar } from './statusBar';
import { showVoiceDownloader } from './voiceDownloader';

/** Separator item for QuickPick */
interface SeparatorItem extends vscode.QuickPickItem {
    kind: vscode.QuickPickItemKind.Separator;
}

/** Action item for QuickPick */
interface ActionItem extends vscode.QuickPickItem {
    action: 'select' | 'download' | 'remove';
    voiceId?: string;
}

type VoiceSelectorItem = ActionItem | SeparatorItem;

/**
 * Show the voice selector QuickPick.
 * If no voices installed, shows download prompt.
 */
export async function showVoiceSelector(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;

    const items: VoiceSelectorItem[] = [];

    if (voices.length === 0) {
        // No voices installed
        items.push({
            label: '$(warning) No voices installed',
            description: '',
            detail: 'Download a voice to get started with text-to-speech',
            action: 'download'
        } as ActionItem);

        items.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator
        } as SeparatorItem);

        items.push({
            label: '$(cloud-download) Download Voice...',
            description: 'EN (US) / ES (MX)',
            action: 'download'
        } as ActionItem);
    } else {
        // Show installed voices
        for (const voice of voices) {
            const isCurrent = voice === currentVoice;
            items.push({
                label: `${isCurrent ? '$(check) ' : '     '}${getVoiceLabel(voice)}`,
                description: isCurrent ? 'Current' : '',
                detail: voice,
                action: 'select',
                voiceId: voice
            } as ActionItem);
        }

        items.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator
        } as SeparatorItem);

        items.push({
            label: '$(cloud-download) Download Voice...',
            description: 'EN (US) / ES (MX)',
            action: 'download'
        } as ActionItem);

        items.push({
            label: '$(trash) Remove Voice...',
            description: '',
            action: 'remove'
        } as ActionItem);
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: '$(globe) ATM Voice TTS',
        placeHolder: voices.length > 0
            ? 'Select a voice or manage voices'
            : 'No voices installed — download one to start',
    });

    if (!selected || (selected as SeparatorItem).kind === vscode.QuickPickItemKind.Separator) {
        return;
    }

    const actionItem = selected as ActionItem;

    switch (actionItem.action) {
        case 'select':
            if (actionItem.voiceId) {
                await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
                    'voice',
                    actionItem.voiceId,
                    vscode.ConfigurationTarget.Global
                );
                updateVoiceStatusBar(context);
            }
            break;

        case 'download':
            await showVoiceDownloader(context);
            break;

        case 'remove':
            await showVoiceRemover(context);
            break;
    }
}

/**
 * Show the voice remover QuickPick.
 */
async function showVoiceRemover(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    if (voices.length === 0) {
        vscode.window.showInformationMessage('No voices to remove.');
        return;
    }

    const items = voices.map(voice => ({
        label: `$(trash) ${getVoiceLabel(voice)}`,
        description: voice,
        detail: 'Click to remove this voice'
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: '$(trash) Remove Voice',
        placeHolder: 'Select a voice to remove',
    });

    if (!selected) { return; }

    const voiceId = selected.description;

    const confirm = await vscode.window.showWarningMessage(
        `Remove voice "${voiceId}"?`,
        { modal: true },
        'Remove'
    );

    if (confirm !== 'Remove') { return; }

    try {
        deleteVoiceFiles(context, voiceId);
        vscode.window.showInformationMessage(`Voice "${voiceId}" removed.`);

        // Reset to default if we removed the current voice
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const currentVoice = config.get<string>('voice');
        if (currentVoice === voiceId) {
            const remaining = getAvailableVoices(context);
            const newVoice = remaining.length > 0 ? remaining[0] : DEFAULT_VOICE;
            await config.update('voice', newVoice, vscode.ConfigurationTarget.Global);
        }

        updateVoiceStatusBar(context);
    } catch (error) {
        console.error('[voice-tts] Error removing voice:', error);
        vscode.window.showErrorMessage(
            'Failed to remove voice: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}

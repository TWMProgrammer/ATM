/**
 * Unified voice selector QuickPick UI.
 * Shows all preset voices grouped by language.
 * - Not installed → gray row with $(cloud-download) button → click to download.
 * - Installed → colored row with $(trash) button → click row to select, button to delete.
 */

import * as vscode from 'vscode';
import {
  CONFIG_SECTION,
  DEFAULT_VOICE,
  PRESET_LANGUAGES,
  isVoiceInstalled,
  deleteVoiceFiles,
  getAvailableVoices,
  type PresetVoice,
  type PresetLanguage,
} from '../core';
import { updateVoiceStatusBar } from './statusBar';
import { executeVoiceDownload } from './voiceDownloader';

// ── Button icons ──────────────────────────────────────────────────────

const downloadButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('cloud-download'),
  tooltip: 'Download voice',
};

const deleteButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('trash'),
  tooltip: 'Remove voice',
};

// ── Item type ─────────────────────────────────────────────────────────

interface VoiceItem extends vscode.QuickPickItem {
  voiceId: string;
  installed: boolean;
  preset: PresetVoice;
  lang: PresetLanguage;
}

// ── Build items ───────────────────────────────────────────────────────

function buildItems(context: vscode.ExtensionContext): VoiceItem[] {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
  const items: VoiceItem[] = [];

  for (const lang of PRESET_LANGUAGES) {
    // Language separator
    items.push({
      label: lang.label,
      kind: vscode.QuickPickItemKind.Separator,
      voiceId: '',
      installed: false,
      preset: {} as PresetVoice,
      lang,
    });

    for (const voice of lang.recommendedVoices) {
      const voiceId = `${lang.catalogKey}-${voice.name}-${voice.quality}`;
      const installed = isVoiceInstalled(context, voiceId);
      const isCurrent = voiceId === currentVoice;

      items.push({
        voiceId,
        installed,
        preset: voice,
        lang,
        label: installed
          ? isCurrent
            ? `$(star-full) ${voice.label}`
            : `$(check) ${voice.label}`
          : `$(circle-slash) ${voice.label}`,
        description: installed
          ? isCurrent
            ? '★ Current'
            : voice.quality
          : 'Not installed',
        detail: voice.description,
        buttons: installed ? [deleteButton] : [downloadButton],
      });
    }
  }

  return items;
}

// ── Show selector ─────────────────────────────────────────────────────

/**
 * Show the unified voice selector.
 */
export async function showVoiceSelector(
  context: vscode.ExtensionContext,
): Promise<void> {
  const qp = vscode.window.createQuickPick<VoiceItem>();
  qp.title = '$(globe) ATM Voice TTS';
  qp.placeholder = 'Select a voice or download one';
  qp.matchOnDescription = true;
  qp.items = buildItems(context);

  // ── Row click ─────────────────────────────────────────────────
  qp.onDidAccept(async () => {
    const selected = qp.selectedItems[0];
    if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) {
      return;
    }

    if (selected.installed) {
      // Select as current voice
      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update('voice', selected.voiceId, vscode.ConfigurationTarget.Global);
      updateVoiceStatusBar(context);
      qp.dispose();
    } else {
      // Download the voice
      qp.dispose();
      await executeVoiceDownload(context, selected.voiceId);
    }
  });

  // ── Button click ──────────────────────────────────────────────
  qp.onDidTriggerItemButton(async (e) => {
    const item = e.item;

    if (item.installed) {
      // Delete voice
      const confirm = await vscode.window.showWarningMessage(
        `Remove voice "${item.preset.label}"?`,
        { modal: true },
        'Remove',
      );
      if (confirm !== 'Remove') {
        return;
      }

      try {
        deleteVoiceFiles(context, item.voiceId);

        // If we removed the current voice, switch to another
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const currentVoice = config.get<string>('voice');
        if (currentVoice === item.voiceId) {
          const remaining = getAvailableVoices(context);
          const newVoice = remaining.length > 0 ? remaining[0] : DEFAULT_VOICE;
          await config.update(
            'voice',
            newVoice,
            vscode.ConfigurationTarget.Global,
          );
        }

        updateVoiceStatusBar(context);

        // Refresh the list in-place
        qp.items = buildItems(context);

        vscode.window.showInformationMessage(
          `Voice "${item.preset.label}" removed.`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          'Failed to remove voice: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    } else {
      // Download voice (button clicked)
      qp.dispose();
      await executeVoiceDownload(context, item.voiceId);
    }
  });

  qp.onDidHide(() => qp.dispose());
  qp.show();
}

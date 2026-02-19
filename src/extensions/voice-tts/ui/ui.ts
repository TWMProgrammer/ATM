import * as vscode from 'vscode';
import * as path from 'path';
import {
  CONFIG_SECTION,
  DEFAULT_VOICE,
  PRESET_LANGUAGES,
  getAvailableVoices,
  ensureVoicesDir,
  getVoiceFilePaths,
  loadVoicesCatalog,
  lookupVoice,
  resolveDownloadUrls,
  isVoiceInstalled,
  deleteVoiceFiles,
  stopCurrentPlayback,
  fileExists,
  getPiperPath,
  getResourcesBasePath,
} from '../core/core';
import {
  downloadFile,
  formatBytes,
  isPiperInstalled,
  installPiper,
} from '../core/installer';
import type { PresetVoice, PresetLanguage } from '../core/types';

export {
  createStatusBarItems,
  updateVoiceStatusBar,
  updatePlayButton,
  setPlayingState,
  getHasTextSelection,
  getIsPlaying,
  disposeStatusBar,
} from './statusBar';

import { updateVoiceStatusBar } from './statusBar';

// ─── QuickPick Buttons ──────────────────────────────────────────────

const DOWNLOAD_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('cloud-download'),
  tooltip: 'Download voice',
};

const DELETE_BUTTON: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('trash'),
  tooltip: 'Remove voice',
};

// ─── Types ──────────────────────────────────────────────────────────

interface VoiceItem extends vscode.QuickPickItem {
  voiceId: string;
  installed: boolean;
  preset: PresetVoice;
  lang: PresetLanguage;
}

// ─── Voice Selector ─────────────────────────────────────────────────

async function buildItems(
  context: vscode.ExtensionContext,
): Promise<VoiceItem[]> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
  const items: VoiceItem[] = [];

  for (const lang of PRESET_LANGUAGES) {
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
      const installed = await isVoiceInstalled(context, voiceId);
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
        buttons: installed ? [DELETE_BUTTON] : [DOWNLOAD_BUTTON],
      });
    }
  }

  return items;
}

export async function showVoiceSelector(
  context: vscode.ExtensionContext,
): Promise<void> {
  const qp = vscode.window.createQuickPick<VoiceItem>();
  qp.title = '$(globe) ATM Voice TTS';
  qp.placeholder = 'Select a voice or download one';
  qp.matchOnDescription = true;
  qp.items = await buildItems(context);

  qp.onDidAccept(async () => {
    const selected = qp.selectedItems[0];
    if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) {
      return;
    }

    if (selected.installed) {
      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update('voice', selected.voiceId, vscode.ConfigurationTarget.Global);
      updateVoiceStatusBar(context);
      qp.dispose();
    } else {
      qp.dispose();
      await executeVoiceDownload(context, selected.voiceId);
    }
  });

  qp.onDidTriggerItemButton(async (e) => {
    const item = e.item;

    if (item.installed) {
      await handleDeleteVoice(context, qp, item);
    } else {
      qp.dispose();
      await executeVoiceDownload(context, item.voiceId);
    }
  });

  qp.onDidHide(() => qp.dispose());
  qp.show();
}

// ─── Delete Voice ───────────────────────────────────────────────────

async function handleDeleteVoice(
  context: vscode.ExtensionContext,
  qp: vscode.QuickPick<VoiceItem>,
  item: VoiceItem,
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Remove voice "${item.preset.label}"?`,
    { modal: true },
    'Remove',
  );
  if (confirm !== 'Remove') {
    return;
  }

  try {
    await deleteVoiceFiles(context, item.voiceId);

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentVoice = config.get<string>('voice');

    if (currentVoice === item.voiceId) {
      const remaining = await getAvailableVoices(context);
      const newVoice = remaining.length > 0 ? remaining[0] : DEFAULT_VOICE;
      await config.update('voice', newVoice, vscode.ConfigurationTarget.Global);
    }

    updateVoiceStatusBar(context);
    qp.items = await buildItems(context);

    vscode.window.showInformationMessage(
      `Voice "${item.preset.label}" removed.`,
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      'Failed to remove voice: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

// ─── Voice Download ─────────────────────────────────────────────────

async function executeVoiceDownload(
  context: vscode.ExtensionContext,
  voiceId: string,
): Promise<void> {
  try {
    const catalog = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ATM Voice TTS',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Loading voices catalog...' });
        return await loadVoicesCatalog(context);
      },
    );

    const voiceEntry = lookupVoice(catalog, voiceId);
    if (!voiceEntry) {
      vscode.window.showErrorMessage(
        `Voice "${voiceId}" not found in catalog.`,
      );
      return;
    }

    const urls = resolveDownloadUrls(voiceEntry);
    if (!urls) {
      vscode.window.showErrorMessage(
        `Could not resolve download URLs for "${voiceId}".`,
      );
      return;
    }

    const voicesDir = await ensureVoicesDir(context);

    const { modelPath, configPath } = await getVoiceFilePaths(context, voiceId);
    const modelSize = formatBytes(urls.modelSizeBytes);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ATM Voice TTS — Setup',
        cancellable: false,
      },
      async (progress) => {
        const piperPath = await getPiperPath(context);
        const piperDir = path.join(
          await getResourcesBasePath(context),
          'piper',
        );

        if (!(await isPiperInstalled(piperPath))) {
          progress.report({
            message: 'Installing Piper TTS engine (first time only)...',
          });
          await installPiper(piperDir, piperPath, progress);
          progress.report({ message: 'Piper engine installed!' });
        }

        progress.report({
          message: `Downloading voice model... 0% (${modelSize})`,
        });
        await downloadFile(urls.modelUrl, modelPath, (p) => {
          const pct = p.percentage ?? 0;
          const downloaded = formatBytes(p.bytesDownloaded);
          progress.report({
            message: `Downloading voice... ${pct}% (${downloaded} / ${modelSize})`,
            increment: pct > 0 ? 1 : 0,
          });
        });

        progress.report({ message: 'Downloading config...' });
        await downloadFile(urls.configUrl, configPath);
        progress.report({ message: 'Complete!' });
      },
    );

    stopCurrentPlayback();

    const modelExists = await fileExists(modelPath);
    const configExists = await fileExists(configPath);
    if (!modelExists || !configExists) {
      throw new Error('Downloaded files not found or not accessible');
    }

    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update('voice', voiceId, vscode.ConfigurationTarget.Global);
    updateVoiceStatusBar(context);

    vscode.window.showInformationMessage(
      `Voice "${voiceId}" downloaded and set as current voice.`,
    );
  } catch (error) {
    console.error('[voice-tts] Download error:', error);
    vscode.window.showErrorMessage(
      'Failed to download voice: ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

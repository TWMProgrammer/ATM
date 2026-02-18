/**
 * Status bar UI components for Voice TTS extension.
 * Provides a globe icon (voice selector) and play/pause button in the bottom-left.
 */

import * as vscode from 'vscode';
import {
  CONFIG_SECTION,
  DEFAULT_VOICE,
  getAvailableVoices,
  getVoiceLabel,
  isPlaying,
} from '../core';

let voiceStatusBarItem: vscode.StatusBarItem;
let playStatusBarItem: vscode.StatusBarItem;
let selectionWatcher: vscode.Disposable | undefined;
let hasTextSelection = false;
let currentlyPlaying = false;

/**
 * Create and register the status bar items.
 */
export function createStatusBarItems(context: vscode.ExtensionContext): void {
  // Globe icon — voice selector (priority 1001 = left of play button)
  voiceStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1001,
  );
  voiceStatusBarItem.command = 'atm.voiceTts.selectVoice';
  voiceStatusBarItem.tooltip = 'ATM Voice TTS — Select voice';
  voiceStatusBarItem.backgroundColor = new vscode.ThemeColor(
    'statusBarItem.errorBackground',
  );
  updateVoiceStatusBar(context);
  voiceStatusBarItem.show();

  // Play/pause button (priority 1000 = right of globe)
  playStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000,
  );
  playStatusBarItem.command = 'atm.voiceTts.togglePlayback';
  updatePlayButton();
  playStatusBarItem.show();

  // Watch text selection changes
  selectionWatcher = vscode.window.onDidChangeTextEditorSelection((e) => {
    const selection = e.textEditor.selection;
    const newHasSelection = !selection.isEmpty;
    if (newHasSelection !== hasTextSelection) {
      hasTextSelection = newHasSelection;
      updatePlayButton();
    }
  });

  // Watch active editor changes
  const editorWatcher = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      hasTextSelection = !editor.selection.isEmpty;
    } else {
      hasTextSelection = false;
    }
    updatePlayButton();
  });

  // Watch configuration changes to update voice label
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      updateVoiceStatusBar(context);
    }
  });

  context.subscriptions.push(
    voiceStatusBarItem,
    playStatusBarItem,
    selectionWatcher,
    editorWatcher,
    configWatcher,
  );
}

/**
 * Update the voice status bar item with current voice info.
 */
export function updateVoiceStatusBar(context: vscode.ExtensionContext): void {
  const voices = getAvailableVoices(context);
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;

  if (voices.length === 0) {
    voiceStatusBarItem.text = '$(globe) No Voice';
    voiceStatusBarItem.tooltip =
      'ATM Voice TTS — No voices installed. Click to download.';
  } else {
    // Show short language code from voice ID (e.g., "en_US" → "EN")
    const langCode =
      currentVoice.split('-')[0]?.split('_')[0]?.toUpperCase() ?? '??';
    voiceStatusBarItem.text = `$(globe) ${langCode}`;
    voiceStatusBarItem.tooltip = `ATM Language (${langCode})`;
  }
}

/**
 * Update the play/pause button state.
 */
export function updatePlayButton(): void {
  if (currentlyPlaying) {
    playStatusBarItem.text = '$(debug-stop) Stop';
    playStatusBarItem.tooltip = 'ATM Voice (pause)';
    playStatusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground',
    );
    playStatusBarItem.color = undefined;
  } else if (hasTextSelection) {
    playStatusBarItem.text = '$(play) Read';
    playStatusBarItem.tooltip = 'ATM Voice (play)';
    playStatusBarItem.backgroundColor = undefined;
    playStatusBarItem.color = undefined;
  } else {
    playStatusBarItem.text = '$(play) Read';
    playStatusBarItem.tooltip = 'ATM Voice (play)';
    playStatusBarItem.backgroundColor = undefined;
    playStatusBarItem.color = new vscode.ThemeColor('disabledForeground');
  }
}

/**
 * Set the playing state and update button.
 */
export function setPlayingState(playing: boolean): void {
  currentlyPlaying = playing;
  updatePlayButton();
}

/**
 * Check if there is a text selection.
 */
export function getHasTextSelection(): boolean {
  return hasTextSelection;
}

/**
 * Check if currently in playing state.
 */
export function getIsPlaying(): boolean {
  return currentlyPlaying;
}

/**
 * Dispose status bar resources.
 */
export function disposeStatusBar(): void {
  if (selectionWatcher) {
    selectionWatcher.dispose();
  }
}

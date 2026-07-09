import * as vscode from 'vscode';
import {CONFIG_SECTION, DEFAULT_VOICE, getAvailableVoices } from '../core/core';

// ─── Debounce Helper ───────────────────────────────────────────────

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): { (): void; dispose(): void } {
  let timer: NodeJS.Timeout | undefined;
  let disposed = false;

  const wrapper = () => {
    if (disposed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, delay);
  };

  wrapper.dispose = () => {
    disposed = true;
    if (timer) {
      clearTimeout(timer);
    }
  };

  return wrapper;
}

// ─── Status Bar Config ──────────────────────────────────────────────

const STATUS_BAR_CONFIG = {
  voice: {
    icon: 'globe',
    tooltip: 'ATM Voice TTS — Select voice',
    command: 'atm.voiceTts.selectVoice',
    alignment: vscode.StatusBarAlignment.Left,
    priority: 1001,
    background: 'statusBarItem.errorBackground',
    color: undefined as string | undefined,
  },

  play: {
    alignment: vscode.StatusBarAlignment.Left,
    priority: 1000,
    command: 'atm.voiceTts.togglePlayback',

    playing: {
      icon: 'debug-stop',
      label: 'Stop',
      tooltip: 'ATM Voice (pause)',
      background: 'statusBarItem.errorBackground',
      color: undefined as string | undefined,
    },

    ready: {
      icon: 'play',
      label: 'Read',
      tooltip: 'ATM Voice (play)',
      background: 'statusBarItem.warningBackground',
      color: undefined as string | undefined,
    },

    idle: {
      icon: 'play',
      label: 'Read',
      tooltip: 'ATM Voice (play)',
      background: undefined as string | undefined,
      color: 'disabledForeground',
    },
  },
};

// ─── State ──────────────────────────────────────────────────────────

let voiceItem: vscode.StatusBarItem;
let playItem: vscode.StatusBarItem;
let selectionWatcher: vscode.Disposable | undefined;
let debouncedUpdate: { (): void; dispose(): void } | undefined;
let hasTextSelection = false;
let currentlyPlaying = false;

// ─── Helpers ────────────────────────────────────────────────────────

interface PlayButtonState {
  icon: string;
  label: string;
  tooltip: string;
  background: string | undefined;
  color: string | undefined;
}

function themeColor(id: string | undefined): vscode.ThemeColor | undefined {
  return id ? new vscode.ThemeColor(id) : undefined;
}

// ─── Public API ─────────────────────────────────────────────────────

export function createStatusBarItems(context: vscode.ExtensionContext): void {
  const vc = STATUS_BAR_CONFIG.voice;
  const pc = STATUS_BAR_CONFIG.play;

  voiceItem = vscode.window.createStatusBarItem(vc.alignment, vc.priority);
  voiceItem.command = vc.command;
  voiceItem.tooltip = vc.tooltip;
  updateVoiceStatusBar(context);
  voiceItem.show();

  playItem = vscode.window.createStatusBarItem(pc.alignment, pc.priority);
  playItem.command = pc.command;
  updatePlayButton();
  playItem.show();

  // Debounced update to avoid excessive calls while typing
  debouncedUpdate = debounce(() => updatePlayButton(), 50);

  selectionWatcher = vscode.window.onDidChangeTextEditorSelection((e) => {
    const newHas = !e.textEditor.selection.isEmpty;
    if (newHas !== hasTextSelection) {
      hasTextSelection = newHas;
      debouncedUpdate?.();
    }
  });

  const editorWatcher = vscode.window.onDidChangeActiveTextEditor((editor) => {
    hasTextSelection = editor ? !editor.selection.isEmpty : false;
    updatePlayButton();
  });

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      updateVoiceStatusBar(context);
    }
  });

  context.subscriptions.push(
    voiceItem,
    playItem,
    selectionWatcher,
    editorWatcher,
    configWatcher,
  );
}

export async function updateVoiceStatusBar(
  context: vscode.ExtensionContext,
): Promise<void> {
  const voices = await getAvailableVoices(context);
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  let currentVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
  const icon = STATUS_BAR_CONFIG.voice.icon;

  // configured voice missing but another exists (possibly shared by a sibling
  // bastndev.* extension) → adopt it instead of showing red "No Voice"
  if (voices.length > 0 && !voices.includes(currentVoice)) {
    currentVoice = voices[0];
    await config.update(
      'voice',
      currentVoice,
      vscode.ConfigurationTarget.Global,
    );
  }

  if (voices.length === 0) {
    voiceItem.text = `$(${icon}) No Voice`;
    voiceItem.tooltip =
      'ATM Voice TTS — No voices installed. Click to download.';
    voiceItem.backgroundColor = themeColor(STATUS_BAR_CONFIG.voice.background);
    voiceItem.color = undefined;
  } else {
    const langCode =
      currentVoice.split('-')[0]?.split('_')[0]?.toUpperCase() ?? '??';
    voiceItem.text = `$(${icon}) ${langCode}`;
    voiceItem.tooltip = `ATM Language (${langCode})`;
    voiceItem.backgroundColor = undefined;
    voiceItem.color = themeColor('focusBorder');
  }
}

export function updatePlayButton(): void {
  const pc = STATUS_BAR_CONFIG.play;
  let state: PlayButtonState;

  if (currentlyPlaying) {
    state = pc.playing;
  } else if (hasTextSelection) {
    state = pc.ready;
  } else {
    state = pc.idle;
  }

  playItem.text = `$(${state.icon}) ${state.label}`;
  playItem.tooltip = state.tooltip;
  playItem.backgroundColor = themeColor(state.background);
  playItem.color = themeColor(state.color);
}

export function setPlayingState(playing: boolean): void {
  currentlyPlaying = playing;
  updatePlayButton();
}

export function getHasTextSelection(): boolean {
  return hasTextSelection;
}

export function getIsPlaying(): boolean {
  return currentlyPlaying;
}

export function disposeStatusBar(): void {
  debouncedUpdate?.dispose();
  selectionWatcher?.dispose();
}

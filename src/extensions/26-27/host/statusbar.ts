'use strict';

import * as vscode from 'vscode';

// ======================================
// GO LIVE (DEV) — STATUS BAR | MARK: STATUSBAR
// ======================================
//
// A unified left-side status bar pill that reflects the combined state of both
// Go Live (26) and Run Dev (27). It shows "Go Live (Dev)" when both are idle,
// highlights when either is running, and provides quick-access commands.

const COMMAND_GO_LIVE_START = 'atm.goLive.start';
const COMMAND_RUN_DEV_START  = 'atm.runDev.start';
const COMMAND_GO_LIVE_STOP   = 'atm.goLive.stop';
const COMMAND_RUN_DEV_STOP   = 'atm.runDev.stop';
const COMMAND_TOGGLE         = 'atm.goLiveDev.toggle';

export type GoLiveDevState =
  | 'idle'
  | 'go-live-starting'
  | 'go-live-live'
  | 'run-dev-starting'
  | 'run-dev-running'
  | 'run-dev-error'
  | 'run-dev-failed';

export class GoLiveDevStatusBar {
  private readonly item: vscode.StatusBarItem;
  private _goLiveState: 'idle' | 'starting' | 'live' = 'idle';
  private _runDevState:  'idle' | 'starting' | 'running' | 'error' | 'failed' = 'idle';
  private _runDevLabel = 'Dev';

  constructor() {
    // Left side, lower priority (40) so it appears to the right of the Diagnostics (Errors/Warnings)
    this.item = vscode.window.createStatusBarItem(
      'atm.goLiveDev.status',
      vscode.StatusBarAlignment.Left,
      40
    );
    this.item.name = 'ATM Go Live (Dev)';
    this.render();
    this.item.show();
  }

  // ------------------------------------
  // Go Live state setters
  // ------------------------------------

  setGoLiveIdle(): void {
    this._goLiveState = 'idle';
    this.render();
  }

  setGoLiveStarting(): void {
    this._goLiveState = 'starting';
    this.render();
  }

  setGoLiveLive(port: number): void {
    this._goLiveState = 'live';
    this._goLivePort = port;
    this.render();
  }

  private _goLivePort = 0;

  // ------------------------------------
  // Run Dev state setters
  // ------------------------------------

  setRunDevIdle(): void {
    this._runDevState = 'idle';
    this.render();
  }

  setRunDevStarting(label: string): void {
    this._runDevState = 'starting';
    this._runDevLabel = label;
    this.render();
  }

  setRunDevRunning(label: string): void {
    this._runDevState = 'running';
    this._runDevLabel = label;
    this.render();
  }

  setRunDevError(label: string): void {
    this._runDevState = 'error';
    this._runDevLabel = label;
    this.render();
  }

  setRunDevFailed(): void {
    this._runDevState = 'failed';
    this.render();
  }

  // ------------------------------------
  // Rendering | MARK: RENDER
  // ------------------------------------

  private render(): void {
    const goLive = this._goLiveState;
    const runDev = this._runDevState;

    // Priority: show the most "active" state first
    if (goLive === 'live') {
      this.item.text = `$(circle-slash) Go Live :${this._goLivePort}  $(play) ${this._runDevLabel}`;
      this.item.tooltip = this.tooltip('Go Live is running. Click to stop the live server.');
      this.item.command = COMMAND_GO_LIVE_STOP;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    if (goLive === 'starting') {
      this.item.text = `$(sync~spin) Go Live…  $(play) ${this._runDevLabel}`;
      this.item.tooltip = this.tooltip('Starting Go Live server…');
      this.item.command = undefined;
      this.item.backgroundColor = undefined;
      return;
    }

    if (runDev === 'running') {
      this.item.text = `$(broadcast) Go Live  $(debug-stop) ${this._runDevLabel}`;
      this.item.tooltip = this.tooltip(`${this._runDevLabel} dev server is running. Click to stop.`);
      this.item.command = COMMAND_RUN_DEV_STOP;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    if (runDev === 'error') {
      this.item.text = `$(broadcast) Go Live  $(warning) ${this._runDevLabel}`;
      this.item.tooltip = this.tooltip(`${this._runDevLabel} dev server has an error. Click to stop.`);
      this.item.command = COMMAND_RUN_DEV_STOP;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      return;
    }

    if (runDev === 'failed') {
      this.item.text = '$(broadcast) Go Live  $(error) Dev Failed';
      this.item.tooltip = this.tooltip('The dev server exited with an error. Click to retry.');
      this.item.command = COMMAND_RUN_DEV_START;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      return;
    }

    if (runDev === 'starting') {
      this.item.text = `$(broadcast) Go Live  $(sync~spin) ${this._runDevLabel}…`;
      this.item.tooltip = this.tooltip('Starting dev server…');
      this.item.command = undefined;
      this.item.backgroundColor = undefined;
      return;
    }

    // Both idle — default "Go Live (Dev)" look
    this.item.text = '$(broadcast) Go Live (Dev)';
    this.item.tooltip = this.tooltip(
      'Click to launch Go Live (static server) or use Alt+G for the dev server (Run Dev).'
    );
    this.item.command = COMMAND_TOGGLE;
    this.item.backgroundColor = undefined;
  }

  private tooltip(detail: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = {
      enabledCommands: [
        COMMAND_GO_LIVE_START,
        COMMAND_GO_LIVE_STOP,
        COMMAND_RUN_DEV_START,
        COMMAND_RUN_DEV_STOP,
        COMMAND_TOGGLE,
      ],
    };
    md.appendMarkdown(`**ATM Go Live (Dev)**\n\n${detail}`);
    md.appendMarkdown(
      `\n\n[$(broadcast) Go Live](command:${COMMAND_GO_LIVE_START} "Start static live server")` +
      `  ·  [$(play) Run Dev](command:${COMMAND_RUN_DEV_START} "Start framework dev server (Alt+G)")`
    );
    return md;
  }

  syncVisibility(show: boolean): void {
    if (show) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

'use strict';

import * as vscode from 'vscode';
import { GoLiveConfig } from './config';
import { getGoLiveDevBar } from '../../26-27';

// ======================================
// GO LIVE — STATUS BAR | MARK: STATUSBAR
// ======================================
//
// The signature "Go Live" control. Toggles between a ready state (click to
// start) and a live state (shows the port, click to stop), with a transient
// spinner while the server is starting or stopping.

const COMMAND_START = 'atm.goLive.start';
const COMMAND_STOP = 'atm.goLive.stop';

export class GoLiveStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      'atm.goLive.status',
      vscode.StatusBarAlignment.Right,
      90
    );
    this.item.name = 'ATM Go Live';
    this.showReady();
    if (GoLiveConfig.showOnStatusbar) {
      this.item.show();
    }
  }

  showReady(): void {
    this.item.text = '$(broadcast) Go Live';
    this.item.tooltip = vscode.l10n.t('Click to start ATM Live Server');
    this.item.command = COMMAND_START;
    this.item.backgroundColor = undefined;
    getGoLiveDevBar()?.setGoLiveIdle();
  }

  showWorking(message: string): void {
    this.item.text = `$(sync~spin) ${message}`;
    this.item.tooltip = vscode.l10n.t('Working…');
    this.item.command = undefined;
    this.item.backgroundColor = undefined;
    getGoLiveDevBar()?.setGoLiveStarting();
  }

  showLive(port: number, lanUrl?: string): void {
    this.item.text = `$(circle-slash) Port : ${port}`;
    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(vscode.l10n.t('ATM Live Server is running. Click to stop.'));
    if (lanUrl) {
      tip.appendMarkdown(`\n\n$(globe) ${lanUrl}`);
    }
    this.item.tooltip = tip;
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    getGoLiveDevBar()?.setGoLiveLive(port);
  }

  /** Re-apply the visibility preference after a settings change. */
  syncVisibility(): void {
    if (GoLiveConfig.showOnStatusbar) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

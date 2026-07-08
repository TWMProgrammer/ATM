'use strict';

import * as vscode from 'vscode';
import { RunDevConfig } from './config';

// ======================================
// RUN DEV — STATUS BAR | MARK: STATUSBAR
// ======================================
//
// One control that reflects the dev server's state: idle (click to run),
// starting (spinner), running (framework + port, click to stop), or failed.

const COMMAND_START = 'atm.runDev.start';
const COMMAND_STOP = 'atm.runDev.stop';

export class RunDevStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      'atm.runDev.status',
      vscode.StatusBarAlignment.Right,
      88
    );
    this.item.name = 'ATM Run Dev';
    this.showIdle();
    if (RunDevConfig.showOnStatusbar) {
      this.item.show();
    }
  }

  showIdle(): void {
    this.item.text = '$(play) Run Dev';
    this.item.tooltip = vscode.l10n.t('Start the project dev server (alt+g)');
    this.item.command = COMMAND_START;
    this.item.backgroundColor = undefined;
  }

  showStarting(label: string): void {
    this.item.text = `$(sync~spin) ${label}…`;
    this.item.tooltip = vscode.l10n.t('Starting the dev server…');
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = undefined;
  }

  showRunning(label: string, port: number | undefined, url: string | undefined): void {
    this.item.text = port ? `$(debug-stop) ${label} :${port}` : `$(debug-stop) ${label}`;
    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(vscode.l10n.t('{0} dev server is running. Click to stop.', label));
    if (url) {
      tip.appendMarkdown(`\n\n$(globe) ${url}`);
    }
    tip.appendMarkdown('\n\n' + vscode.l10n.t('Restart: ctrl+g  ·  Stop: ctrl+alt+g'));
    this.item.tooltip = tip;
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  /**
   * The dev server process is still alive (unlike showFailed) but its own
   * output just logged an app-level error (bad import, runtime exception, …).
   * The controller reveals the terminal alongside this (without stealing
   * focus) so the user can see what broke. Click still stops the server.
   */
  showRunningWithError(label: string, port: number | undefined, url: string | undefined): void {
    this.item.text = port ? `$(warning) ${label} :${port}` : `$(warning) ${label}`;
    const tip = new vscode.MarkdownString(undefined, true);
    tip.appendMarkdown(
      vscode.l10n.t('{0} hit an error — see the terminal (opened below). Still running; click to stop.', label)
    );
    if (url) {
      tip.appendMarkdown(`\n\n$(globe) ${url}`);
    }
    tip.appendMarkdown('\n\n' + vscode.l10n.t('Restart: ctrl+g  ·  Stop: ctrl+alt+g'));
    this.item.tooltip = tip;
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  showFailed(): void {
    this.item.text = '$(error) Dev Failed';
    this.item.tooltip = vscode.l10n.t('The dev server exited with an error. Click to retry.');
    this.item.command = COMMAND_START;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  syncVisibility(): void {
    if (RunDevConfig.showOnStatusbar) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

'use strict';

import * as vscode from 'vscode';
import { RunDevConfig } from './config';
import { getGoLiveDevBar } from '../../..';

// ======================================
// RUN DEV — STATUS BAR | MARK: STATUSBAR
// ======================================
//
// One control that reflects the dev server's state: idle (click to run),
// starting (spinner), running (framework + port, click to stop), or failed.

const COMMAND_START = 'atm.runDev.start';
const COMMAND_STOP = 'atm.runDev.stop';
const COMMAND_RESTART = 'atm.runDev.restart';
const COMMAND_OPEN = 'atm.runDev.openBrowser';

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
    getGoLiveDevBar()?.setRunDevIdle();
  }

  showStarting(label: string): void {
    this.item.text = `$(sync~spin) ${label}…`;
    this.item.tooltip = vscode.l10n.t('Starting the dev server…');
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = undefined;
    getGoLiveDevBar()?.setRunDevStarting(label);
  }

  showRunning(label: string, port: number | undefined, url: string | undefined): void {
    this.item.text = port ? `$(debug-stop) ${label} :${port}` : `$(debug-stop) ${label}`;
    this.item.tooltip = this.actionTooltip(vscode.l10n.t('{0} · running', label), url);
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    getGoLiveDevBar()?.setRunDevRunning(label);
  }

  /**
   * The dev server process is still alive (unlike showFailed) but its own
   * output just logged an app-level error (bad import, runtime exception, …).
   * The controller reveals the terminal alongside this (without stealing
   * focus) so the user can see what broke, and does NOT auto-open the browser
   * — the ▶ button below does that on demand. Click still stops the server.
   */
  showRunningWithError(label: string, port: number | undefined, url: string | undefined): void {
    this.item.text = port ? `$(warning) ${label} :${port}` : `$(warning) ${label}`;
    this.item.tooltip = this.actionTooltip(vscode.l10n.t('{0} · error — see terminal', label), url);
    this.item.command = COMMAND_STOP;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    getGoLiveDevBar()?.setRunDevError(label);
  }

  /**
   * Compact tooltip with clickable command buttons: ▶ opens the browser (handy
   * after an error, since it's no longer auto-opened) and ⟳ restarts (re-runs
   * once you've fixed the code, re-opening the browser on success). The pill
   * click itself stops. `isTrusted` is scoped to just these two commands.
   */
  private actionTooltip(headline: string, url: string | undefined): vscode.MarkdownString {
    const tip = new vscode.MarkdownString(undefined, true);
    tip.isTrusted = { enabledCommands: [COMMAND_OPEN, COMMAND_RESTART] };
    tip.appendMarkdown(headline);
    if (url) {
      tip.appendMarkdown(`\n\n$(globe) ${url}`);
    }
    const open = vscode.l10n.t('Open');
    const restart = vscode.l10n.t('Restart');
    // Keyboard shortcuts live in the hover titles so the visible row stays short.
    tip.appendMarkdown(
      `\n\n[$(play) ${open}](command:${COMMAND_OPEN} "${vscode.l10n.t('Open in browser')}")` +
        `  ·  [$(refresh) ${restart}](command:${COMMAND_RESTART} "${vscode.l10n.t('Restart (ctrl+g)')}")`
    );
    return tip;
  }

  showFailed(): void {
    this.item.text = '$(error) Dev Failed';
    this.item.tooltip = vscode.l10n.t('The dev server exited with an error. Click to retry.');
    this.item.command = COMMAND_START;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    getGoLiveDevBar()?.setRunDevFailed();
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

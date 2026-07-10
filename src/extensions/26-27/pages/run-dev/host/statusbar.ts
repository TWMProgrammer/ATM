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
  constructor() {
    this.showIdle();
  }

  showIdle(): void {
    getGoLiveDevBar()?.setRunDevIdle();
  }

  showStarting(label: string): void {
    getGoLiveDevBar()?.setRunDevStarting(label);
  }

  showRunning(label: string, port: number | undefined, url: string | undefined): void {
    getGoLiveDevBar()?.setRunDevRunning(label);
  }

  showRunningWithError(label: string, port: number | undefined, url: string | undefined): void {
    getGoLiveDevBar()?.setRunDevError(label);
  }

  showFailed(): void {
    getGoLiveDevBar()?.setRunDevFailed();
  }

  syncVisibility(): void {
    // Visibility is managed by the combined left-side bar.
  }

  dispose(): void {}
}

'use strict';

import * as vscode from 'vscode';
import { GoLiveConfig } from './config';
import { getGoLiveDevBar } from '../../..';

// ======================================
// GO LIVE — STATUS BAR | MARK: STATUSBAR
// ======================================
//
// The signature "Go Live" control. Toggles between a ready state (click to
// start) and a live state (shows the port, click to stop), with a transient
// spinner while the server is starting or stopping.

const COMMAND_START = 'atm.goLive.start';
const COMMAND_STOP  = 'atm.goLive.stop';

export class GoLiveStatusBar {
	constructor() {
		this.showReady();
	}

	showReady(): void {
		getGoLiveDevBar()?.setGoLiveIdle();
	}

	showWorking(message: string): void {
		getGoLiveDevBar()?.setGoLiveStarting();
	}

	showLive(port: number, lanUrl?: string): void {
		getGoLiveDevBar()?.setGoLiveLive(port);
	}

	/** Re-apply the visibility preference after a settings change. */
	syncVisibility(): void {
		// Visibility is managed by the combined left-side bar.
	}

	dispose(): void {}
}

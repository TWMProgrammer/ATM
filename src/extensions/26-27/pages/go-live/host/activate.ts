'use strict';

import * as vscode from 'vscode';
import { GoLiveController } from './controller';
import { GoLiveStatusBar } from './statusbar';

// ======================================
// GO LIVE — ACTIVATION | MARK: ACTIVATE
// ======================================
//
// ATM module 26-go (housed in 26-27/pages/go-live): a local development server
// with live reload — a lean, dependency-light reimagining of Live Server.
// Registers the Go Live status bar control plus start/stop/changeWorkspace commands.

let statusBar: GoLiveStatusBar | undefined;
let controller: GoLiveController | undefined;

export function activateGoLive(context: vscode.ExtensionContext): void {
	statusBar = new GoLiveStatusBar();
	controller = new GoLiveController(statusBar);
	const activeController = controller;

	context.subscriptions.push(
		vscode.commands.registerCommand('atm.goLive.start', (uri?: vscode.Uri) => {
			const fileUri = uri instanceof vscode.Uri ? uri : undefined;
			guard(async () => {
				// Serve the on-disk content, not unsaved buffers.
				await vscode.workspace.saveAll(false);
				await activeController.start(fileUri);
			});
		}),
		vscode.commands.registerCommand('atm.goLive.stop', () => {
			guard(() => activeController.stop());
		}),
		vscode.commands.registerCommand('atm.goLive.changeWorkspace', () => {
			guard(() => activeController.changeWorkspace());
		}),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('atm.goLive.showOnStatusbar')) {
				statusBar?.syncVisibility();
			}
		}),
		{ dispose: () => void activeController.dispose() },
		statusBar
	);
}

function guard(fn: () => Promise<void> | void): void {
	void Promise.resolve()
		.then(fn)
		.catch((error) => {
			const detail = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(vscode.l10n.t('Go Live failed: {0}', detail));
		});
}

export async function deactivateGoLive(): Promise<void> {
	await controller?.dispose().catch(() => undefined);
	controller = undefined;
	statusBar = undefined;
}

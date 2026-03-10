import * as vscode from 'vscode';
import { createStatusBarItem } from './ui/statusBar';

export async function activateColorDebugging(context: vscode.ExtensionContext) {
    /* =========================================================
     * 🎨 INITIALIZE STATUS BAR UI
     * ========================================================= */
    createStatusBarItem(context);
}

export async function deactivateColorDebugging() {
    /* =========================================================
     * 🛑 DEACTIVATION
     * Colors persist in workspace settings to avoid visual glitches.
     * Removing them takes time and leaves a partial state on exit.
     * ========================================================= */
}

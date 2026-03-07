import * as vscode from 'vscode';
import { createStatusBarItem } from './ui/statusBar';

export async function activateColorDebugging(context: vscode.ExtensionContext) {
    // Create the status bar UI
    createStatusBarItem(context);
}

export async function deactivateColorDebugging() {
    // No longer attempting to clean up colors on exit to avoid visual glitches
    // Colors will simply persist in the workspace settings. Removing them
    // takes time and results in a partially saved state when VS Code quits.
}

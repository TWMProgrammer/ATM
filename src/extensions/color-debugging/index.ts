import * as vscode from 'vscode';
import { handleStartup, clearWorkspaceColors, clearWorkspaceColorsImmediate } from './core/manager';
import { createStatusBarItem } from './ui/statusBar';

export async function activateColorDebugging(context: vscode.ExtensionContext) {
    // 1. Create the status bar UI
    createStatusBarItem(context);

    // 2. Handle the startup logic (Clean leftover colors, apply if F5 mode)
    await handleStartup(context);
}

export async function deactivateColorDebugging() {
    // When the extension is deactivated (VS Code window closes)
    // Wipe out the colors immediately without queues so VS Code saves them before exiting!
    await clearWorkspaceColorsImmediate();
}

import * as vscode from 'vscode';
import { applyRandomColor, clearWorkspaceColors, hasColorApplied } from '../core/manager';

export const COMMAND_ID = 'color-debugging.changeColor';

export function createStatusBarItem(context: vscode.ExtensionContext) {
    /* =========================================================
     * 🎨 STATUS BAR ITEM INITIALIZATION
     * ========================================================= */
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = COMMAND_ID;

    // Initial check for icon/text state
    updateStatusBarState(statusBarItem);

    const commandDisposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
        if (hasColorApplied()) {
            await clearWorkspaceColors();
        } else {
            await applyRandomColor();
        }
        
        // Update the UI after the configuration has been modified
        updateStatusBarState(statusBarItem);
    });

    /* =========================================================
     * 👁️ LISTENERS
     * Listen to config changes to automatically update icon
     * ========================================================= */
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('workbench.colorCustomizations')) {
            updateStatusBarState(statusBarItem);
        }
    });

    context.subscriptions.push(commandDisposable);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(configListener);

    statusBarItem.show();
}

/* =========================================================
 * 🔄 UPDATE STATE
 * Helper to switch the button based on the current state
 * ========================================================= */
function updateStatusBarState(statusBarItem: vscode.StatusBarItem) {
    if (hasColorApplied()) {
        statusBarItem.text = "$(x) Color";
        statusBarItem.tooltip = "Remove Workspace Color";
    } else {
        statusBarItem.text = "$(paintcan) Color";
        statusBarItem.tooltip = "Apply Random Workspace Color";
    }
}

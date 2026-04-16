import * as vscode from 'vscode';
import { applyRandomColor, clearWorkspaceColors, hasColorApplied } from '../core/manager';
import { updateToolState } from '../../zhared/zhared';

export const COMMAND_ID = 'color-debugging.changeColor';

export function createStatusBarItem(context: vscode.ExtensionContext) {
    /* =========================================================
     * 🎨 STATUS BAR ITEM INITIALIZATION (Delegated to Zhared)
     * ========================================================= */
    const commandDisposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
        if (hasColorApplied()) {
            await clearWorkspaceColors();
        } else {
            await applyRandomColor();
        }
        
        // Update the UI after the configuration has been modified
        updateStatusBarState();
    });

    /* =========================================================
     * 👁️ LISTENERS
     * Listen to config changes to automatically update icon
     * ========================================================= */
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('workbench.colorCustomizations')) {
            updateStatusBarState();
        }
    });

    context.subscriptions.push(commandDisposable);
    context.subscriptions.push(configListener);

    // Initial check for icon/text state
    updateStatusBarState();
}

/* =========================================================
 * 🔄 UPDATE STATE
 * Helper to switch the button based on the current state
 * ========================================================= */
function updateStatusBarState() {
    let icon = '$(paintcan)';
    let desc = 'Color aleatorio al hacer clic';

    if (hasColorApplied()) {
        icon = '$(x)';
        desc = 'Remover color al hacer clic';
    }

    // Le notificamos a la barra global
    updateToolState({
        id: 'color-debugging',
        name: 'Color',
        icon: icon,
        command: COMMAND_ID,
        description: desc
    });
}

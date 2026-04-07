import * as vscode from 'vscode';
import { updateStatusBar } from './statusBar';

export function activateCommands(context: vscode.ExtensionContext, toggleClient: (enable: boolean) => void) {
    let isEnabled = true;

    // Toggle command: Enables/disables the engine
    const toggleCommand = vscode.commands.registerCommand('atm.eslint.toggle', () => {
        isEnabled = !isEnabled;
        
        // Notify the client to start or stop the LSP server
        toggleClient(isEnabled);
        
        // Update the Status Bar UI
        updateStatusBar(isEnabled);
        
        const stateMsg = isEnabled ? 'Activated ✅' : 'Deactivated ❌';
        vscode.window.showInformationMessage(`[ATM] ESLint has been ${stateMsg}`);
    });

    context.subscriptions.push(toggleCommand);
}

import * as vscode from 'vscode';
import { updateStatusBar } from './statusBar';

export function activateCommands(context: vscode.ExtensionContext, toggleClient: (enable: boolean) => Promise<void>) {
    let isEnabled = true;

    // Toggle command: Enables/disables the engine
    const toggleCommand = vscode.commands.registerCommand('atm.eslint.toggle', async () => {
        const nextState = !isEnabled;

        try {
            // Notify the client to start or stop the LSP server
            await toggleClient(nextState);

            // Update state only after successful start/stop
            isEnabled = nextState;
            updateStatusBar(isEnabled);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`ATM ESLint toggle failed: ${errorMessage}`);
        }
    });

    context.subscriptions.push(toggleCommand);
}

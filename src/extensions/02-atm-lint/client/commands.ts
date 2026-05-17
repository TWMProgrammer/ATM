import * as vscode from 'vscode';
import { updateStatusBar, getStatusBarState } from './statusBar';

export function activateCommands(
    context: vscode.ExtensionContext,
    toggleClient: (enable: boolean) => Promise<void>,
    revalidateDiagnostics: () => Promise<number>,
    isClientEnabled: () => boolean
) {
    // Toggle command: Enables/disables the engine
    const toggleCommand = vscode.commands.registerCommand('atm.lint.toggle', async () => {
        const state = getStatusBarState();

        // If we are in "missing-config" state, clicking just shows the explanation message
        if (state.isEnabled && state.status === 'missing-config') {
            vscode.window.showInformationMessage(`ATMLint: No ESLint configuration found for this project.`);
            return;
        }

        const nextState = !isClientEnabled();

        try {
            // Notify the client to start or stop the LSP server
            await toggleClient(nextState);

            // Reflect real client state after toggling.
            updateStatusBar(isClientEnabled(), state.status);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            updateStatusBar(isClientEnabled(), state.status);
            vscode.window.showErrorMessage(`ATM Lint toggle failed: ${errorMessage}`);
        }
    });

    const revalidateCommand = vscode.commands.registerCommand('atm.lint.revalidateOpenFiles', async () => {
        try {
            const revalidatedDocuments = await revalidateDiagnostics();
            vscode.window.showInformationMessage(`ATM Lint revalidated ${revalidatedDocuments} open file(s).`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`ATM Lint revalidation failed: ${errorMessage}`);
        }
    });

    context.subscriptions.push(toggleCommand, revalidateCommand);
}

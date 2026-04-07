import * as vscode from 'vscode';
import { updateStatusBar } from './statusBar';

export function activateCommands(
    context: vscode.ExtensionContext,
    toggleClient: (enable: boolean) => Promise<void>,
    revalidateDiagnostics: () => Promise<number>
) {
    let isEnabled = true;

    // Toggle command: Enables/disables the engine
    const toggleCommand = vscode.commands.registerCommand('atm.lint.toggle', async () => {
        const nextState = !isEnabled;

        try {
            // Notify the client to start or stop the LSP server
            await toggleClient(nextState);

            // Update state only after successful start/stop
            isEnabled = nextState;
            updateStatusBar(isEnabled);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
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

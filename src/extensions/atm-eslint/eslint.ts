// Barrel file to orchestrate the ESLint client and ATM integration
import { ExtensionContext } from 'vscode';
import { activateEslintClient, deactivateEslintClient, startClient, stopClient } from './client/eslintClient';
import { activateStatusBar } from './client/statusBar';
import { activateCommands } from './client/commands';

export function activateEslint(context: ExtensionContext) {
    // 1. Setup LSP client
    activateEslintClient(context);

    // 2. Initialize Status Bar icon
    activateStatusBar(context);

    // 3. Register commands and start the server initially
    activateCommands(context, async (enable: boolean) => {
        if (enable) {
            await startClient();
        } else {
            await stopClient();
        }
    });

    // Start the server by default
    void startClient().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ATM ESLint] Failed to start client: ${errorMessage}`);
    });
}

export function deactivateEslint(): Thenable<void> | undefined {
    return deactivateEslintClient();
}
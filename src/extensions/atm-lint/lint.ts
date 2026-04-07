// Barrel file to orchestrate the Lint client and ATM integration
import { ExtensionContext } from 'vscode';
import { activateLintClient, deactivateLintClient, revalidateOpenDocuments, startClient, stopClient } from './client/lintClient';
import { activateStatusBar } from './client/statusBar';
import { activateCommands } from './client/commands';

export function activateLint(context: ExtensionContext) {
    // 1. Setup LSP client
    activateLintClient(context);

    // 2. Initialize Status Bar icon
    activateStatusBar(context);

    // 3. Register commands and start the server initially
    activateCommands(context, async (enable: boolean) => {
        if (enable) {
            await startClient();
        } else {
            await stopClient();
        }
    }, async () => revalidateOpenDocuments());

    // Start the server by default
    void startClient().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ATM Lint] Failed to start client: ${errorMessage}`);
    });
}

export function deactivateLint(): Thenable<void> | undefined {
    return deactivateLintClient();
}
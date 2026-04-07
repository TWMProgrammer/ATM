// ARCHIVO BARRIL: Orquesta el inicio del cliente e integra con ATM
import { ExtensionContext } from 'vscode';
import { activateEslintClient, deactivateEslintClient, startClient, stopClient } from './client/eslintClient';
import { activateStatusBar } from './client/statusBar';
import { activateCommands } from './client/commands';

export function activateEslint(context: ExtensionContext) {
    // 1. Configuramos el cliente LSP
    activateEslintClient(context);

    // 2. Encendemos el ícono de la Status Bar
    activateStatusBar(context);

    // 3. Registramos el comando para apagar/prender e iniciamos el servidor la primera vez
    activateCommands(context, async (enable: boolean) => {
        if (enable) {
            await startClient();
        } else {
            await stopClient();
        }
    });

    // Arrancamos el servidor por defecto al iniciar VS Code
    startClient();
}

export function deactivateEslint(): Thenable<void> | undefined {
    return deactivateEslintClient();
}
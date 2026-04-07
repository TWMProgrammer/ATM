// ARCHIVO BARRIL: Orquesta el inicio del cliente e integra con ATM
import { ExtensionContext } from 'vscode';
import { activateEslintClient, deactivateEslintClient } from './client/eslintClient';

export function activateEslint(context: ExtensionContext) {
    // 1. Iniciamos el cliente LSP
    activateEslintClient(context);

    // [Futuro]: Aquí también registraremos Comandos (.registerCommand)
    // o encenderemos tu status bar (statusBar.ts) que crearemos después.
}

export function deactivateEslint(): Thenable<void> | undefined {
    return deactivateEslintClient();
}
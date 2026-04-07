import * as vscode from 'vscode';
import { updateStatusBar } from './statusBar';

export function activateCommands(context: vscode.ExtensionContext, toggleClient: (enable: boolean) => void) {
    let isEnabled = true;

    // 1. Comando Toggle: Enciende y apaga el motor
    const toggleCommand = vscode.commands.registerCommand('atm.eslint.toggle', () => {
        isEnabled = !isEnabled;
        
        // Llamamos a la función que apaga o prende el cliente LSP
        toggleClient(isEnabled);
        
        // Actualizamos la interfaz del Status Bar
        updateStatusBar(isEnabled);
        
        const stateMsg = isEnabled ? 'Activado ✅' : 'Desactivado ❌';
        vscode.window.showInformationMessage(`[ATM] ESLint ha sido ${stateMsg}`);
    });

    context.subscriptions.push(toggleCommand);
}

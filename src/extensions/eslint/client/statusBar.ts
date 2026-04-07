import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;

export function activateStatusBar(context: vscode.ExtensionContext) {
    // Creamos el ícono en la parte inferior derecha de VS Code
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    // Le asignamos el comando que ejecutará al hacerle click
    statusBarItem.command = 'atm.eslint.toggle';
    context.subscriptions.push(statusBarItem);
    
    // Inicialmente encendido
    updateStatusBar(true);
    statusBarItem.show();
}

/**
 * Cambia el estado visual del botón según si ESLint está corriendo o pausado.
 */
export function updateStatusBar(isEnabled: boolean) {
    if (isEnabled) {
        // Estado Encendido (Verde / Normal)
        statusBarItem.text = '$(check) ATM ESLint';
        statusBarItem.tooltip = 'ESLint (ATM) está activo. Haz clic para apagarlo.';
        statusBarItem.color = undefined; // Usa el color normal del tema
    } else {
        // Estado Apagado (Rojo / Error)
        statusBarItem.text = '$(circle-slash) ATM ESLint';
        statusBarItem.tooltip = 'ESLint (ATM) está pausado. Haz clic para encenderlo.';
        // Lo pintamos de rojo o del color de error del tema del usuario
        statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }
}

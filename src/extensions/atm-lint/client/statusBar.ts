import * as vscode from 'vscode';
import { updateToolState } from '../../zhared/zhared';

let currentStatus: 'ok' | 'missing-config' | 'error' = 'ok';
let currentIsEnabled: boolean = true;

export function getStatusBarState() {
    return { isEnabled: currentIsEnabled, status: currentStatus };
}

export function activateStatusBar(context: vscode.ExtensionContext) {
    // Al inicializar ahora solo enviamos el estado al gestor central
    updateStatusBar(true);
}

/**
 * Updates the Status Bar UI based on the engine state
 */
export function updateStatusBar(isEnabled: boolean, status: 'ok' | 'missing-config' | 'error' = 'ok') {
    currentIsEnabled = isEnabled;
    currentStatus = status;

    let icon = '$(check)';
    let desc = 'Activo';

    if (isEnabled) {
        if (status === 'missing-config') {
            icon = '$(info)';
            desc = 'Falta configuración';
        } else if (status === 'error') {
            icon = '$(error)';
            desc = 'Error';
        } else {
            icon = '$(check)';
            desc = 'Activo';
        }
    } else {
        icon = '$(circle-slash)';
        desc = 'Pausado';
    }

    // Le notificamos a la barril shared global
    updateToolState({
        id: 'atm-lint',
        name: 'ATM Lint',
        icon: icon,
        command: 'atm.lint.toggle',
        description: desc
    });
}

import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;
let currentStatus: 'ok' | 'missing-config' | 'error' = 'ok';
let currentIsEnabled: boolean = true;

export function getStatusBarState() {
    return { isEnabled: currentIsEnabled, status: currentStatus };
}

export function activateStatusBar(context: vscode.ExtensionContext) {
    // Create the icon in the bottom right of VS Code
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    // Assign the toggle command
    statusBarItem.command = 'atm.lint.toggle';
    context.subscriptions.push(statusBarItem);
    
    // Initially enabled
    updateStatusBar(true);
    statusBarItem.show();
}

/**
 * Updates the Status Bar UI based on the engine state
 */
export function updateStatusBar(isEnabled: boolean, status: 'ok' | 'missing-config' | 'error' = 'ok') {
    currentIsEnabled = isEnabled;
    currentStatus = status;

    if (isEnabled) {
        if (status === 'missing-config') {
            statusBarItem.text = '$(info) ATM Lint';
            statusBarItem.tooltip = 'ATMLint: No ESLint configuration found.';
            statusBarItem.color = undefined;
        } else if (status === 'error') {
            statusBarItem.text = '$(error) ATM Lint';
            statusBarItem.tooltip = 'ATMLint: Error running ESLint.';
            statusBarItem.color = new vscode.ThemeColor('errorForeground');
        } else {
            // Active State (Normal)
            statusBarItem.text = '$(check) ATM Lint';
            statusBarItem.tooltip = 'Lint (ATM) is active. Click to disable.';
            statusBarItem.color = undefined;
        }
    } else {
        // Disabled State (Error color)
        statusBarItem.text = '$(circle-slash) ATM Lint';
        statusBarItem.tooltip = 'Lint (ATM) is paused. Click to enable.';
        statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }
}

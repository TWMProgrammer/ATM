import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;

export function activateStatusBar(context: vscode.ExtensionContext) {
    // Create the icon in the bottom right of VS Code
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    // Assign the toggle command
    statusBarItem.command = 'atm.eslint.toggle';
    context.subscriptions.push(statusBarItem);
    
    // Initially enabled
    updateStatusBar(true);
    statusBarItem.show();
}

/**
 * Updates the Status Bar UI based on the engine state
 */
export function updateStatusBar(isEnabled: boolean) {
    if (isEnabled) {
        // Active State (Normal)
        statusBarItem.text = '$(check) ATM ESLint';
        statusBarItem.tooltip = 'ESLint (ATM) is active. Click to disable.';
        statusBarItem.color = undefined;
    } else {
        // Disabled State (Error color)
        statusBarItem.text = '$(circle-slash) ATM ESLint';
        statusBarItem.tooltip = 'ESLint (ATM) is paused. Click to enable.';
        statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }
}

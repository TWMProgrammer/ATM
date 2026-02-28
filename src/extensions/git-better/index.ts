import * as vscode from 'vscode';
import { GitBetterManager } from './gitManager';

let manager: GitBetterManager | undefined;

export function activateGitBetter(context: vscode.ExtensionContext) {
    if (!manager) {
        manager = new GitBetterManager(context);
        context.subscriptions.push(manager);
    }
}

export function deactivateGitBetter() {
    if (manager) {
        manager.dispose();
        manager = undefined;
    }
}

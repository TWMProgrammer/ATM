import * as vscode from 'vscode';
import { GitBetterManager } from './commit-view/manager';
import { GraphPanelProvider } from './gitlab-panel/core/provider';

let manager: GitBetterManager | undefined;
let providerDispose: vscode.Disposable | undefined;

export function activateGitBetter(context: vscode.ExtensionContext) {
    if (!manager) {
        manager = new GitBetterManager(context);
        context.subscriptions.push(manager);
    }

    const provider = new GraphPanelProvider(context.extensionUri);
    providerDispose = vscode.window.registerWebviewViewProvider(
        GraphPanelProvider.viewType,
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );
    context.subscriptions.push(providerDispose);
}

export function deactivateGitBetter() {
    if (manager) {
        manager.dispose();
        manager = undefined;
    }
    if (providerDispose) {
        providerDispose.dispose();
        providerDispose = undefined;
    }
}

import * as vscode from 'vscode';
import { YouTubeMusicViewProvider } from './view/view';
import { stopAudioServer } from './screens/atm-music/core/handler';
import { ATMDataProvider } from './screens/atm-data/core/provider';

export function activateFocus(context: vscode.ExtensionContext) {
    ATMDataProvider.getInstance().init(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'atm-yt-music-view',
            new YouTubeMusicViewProvider(context.extensionUri),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

export function deactivateFocus() {
    stopAudioServer();
}

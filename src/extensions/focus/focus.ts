import * as vscode from 'vscode';
import { YouTubeMusicViewProvider } from './view/view';
import { stopAudioServer } from './screens/atm-music/shared/server/handler';
import { ATMDataProvider } from './screens/atm-data/core/provider';

export function activateFocus(context: vscode.ExtensionContext) {
    ATMDataProvider.getInstance().init(context);

    const provider = new YouTubeMusicViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'atm-yt-music-view',
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('atm.music.togglePlayPause', () => {
            vscode.commands.executeCommand('atm-yt-music-view.focus');
            provider.togglePlayPause();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('atm.music.playRandomAM', () => {
            vscode.commands.executeCommand('atm-yt-music-view.focus');
            provider.playRandomAM();
        })
    );
}

export function deactivateFocus() {
    stopAudioServer();
}

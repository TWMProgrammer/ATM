import * as vscode from 'vscode';
import { registerTranslatorCommands } from './commands';
import { setupTranslatorPanel, translatorPanelViewType } from './panel';
import { registerSecretCommands } from './secrets';

export function activateAtmTranslate(context: vscode.ExtensionContext): void {
	registerSecretCommands(context);

	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(translatorPanelViewType, {
			async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { text?: string }) {
				setupTranslatorPanel(panel, context, state?.text);
			},
		})
	);

	registerTranslatorCommands(context);
}


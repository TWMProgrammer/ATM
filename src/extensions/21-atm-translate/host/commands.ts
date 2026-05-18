import * as vscode from 'vscode';
import { openTranslatorPanel } from './panel';

const openTranslatorCommand = 'atm.translate.open';

export function registerTranslatorCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(openTranslatorCommand, (text?: string) => {
			openTranslatorPanel(context, text);
		})
	);
}


import * as vscode from 'vscode';
import { formatterSettingKeys } from '../core/options';
import { languageRegistry } from '../core/languageRegistry';

/**
 * Status bar item showing whether ATM Formatter is active for the current
 * document's language.  Clicking it reveals the output channel.
 */
export class FormatterStatusBar {
	private readonly item: vscode.StatusBarItem;
	private readonly outputChannel: vscode.OutputChannel;

	constructor(outputChannel: vscode.OutputChannel) {
		this.outputChannel = outputChannel;
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
		this.item.text = '$(check) ATM Formatter';
		this.item.tooltip = 'ATM Formatter is active';
		this.item.command = 'atm.formatter.showOutput';
	}

	/** Update the status bar based on the active editor's language. */
	update(editor: vscode.TextEditor | undefined): void {
		const enabled = vscode.workspace.getConfiguration().get<boolean>(formatterSettingKeys.enable, true);
		if (!enabled) {
			this.item.text = '$(circle-slash) ATM Formatter';
			this.item.tooltip = 'ATM Formatter is disabled';
			this.item.hide();
			return;
		}

		if (!editor || !editor.document) {
			this.item.hide();
			return;
		}

		const supported = languageRegistry.isLanguageSupported(editor.document.languageId);
		if (supported) {
			this.item.text = '$(check) ATM Fmt';
			this.item.tooltip = `ATM Formatter — ${editor.document.languageId}`;
			this.item.show();
		} else {
			this.item.hide();
		}
	}

	showOutput(): void {
		this.outputChannel.show(true);
	}

	dispose(): void {
		this.item.dispose();
	}
}

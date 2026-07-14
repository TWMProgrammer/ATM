import * as vscode from 'vscode';
import { readHeadFile } from './core/git';
import { findBeforeSelection } from './core/selection';
import { BeforePreviewController, COPY_COMMAND_ID, RESTORE_COMMAND_ID } from './ui/preview';

const COMMAND_ID = 'atm.beforeAfter.showBefore';

export function activateBeforeAfter(context: vscode.ExtensionContext): void {
	const preview = new BeforePreviewController();
	context.subscriptions.push(
		vscode.languages.registerHoverProvider({ scheme: 'file' }, preview),
		vscode.commands.registerTextEditorCommand(COMMAND_ID, (editor) => {
			void showBefore(editor, preview);
		}),
		vscode.commands.registerCommand(COPY_COMMAND_ID, (snapshotId: string) => preview.copy(snapshotId)),
		vscode.commands.registerCommand(RESTORE_COMMAND_ID, (snapshotId: string) => preview.restore(snapshotId))
	);
}

async function showBefore(editor: vscode.TextEditor, preview: BeforePreviewController): Promise<void> {
	const { document, selection } = editor;
	if (document.uri.scheme !== 'file') {
		void vscode.window.showInformationMessage(vscode.l10n.t('Before & After only works with files on disk.'));
		return;
	}
	if (selection.isEmpty) {
		void vscode.window.showInformationMessage(vscode.l10n.t('Select the changed code first.'));
		return;
	}

	const result = await readHeadFile(document.uri.fsPath);
	if (result.status === 'no-repository') {
		void vscode.window.showInformationMessage(vscode.l10n.t('This file is not inside a Git repository.'));
		return;
	}
	if (result.status === 'no-baseline') {
		void vscode.window.showInformationMessage(vscode.l10n.t('This file has no committed version to compare.'));
		return;
	}

	const selected = findBeforeSelection(result.content, document.getText(), {
		start: { line: selection.start.line, character: selection.start.character },
		end: { line: selection.end.line, character: selection.end.character }
	});
	if (selected.status === 'unchanged') {
		void vscode.window.showInformationMessage(vscode.l10n.t('The selected code has no changes compared with HEAD.'));
		return;
	}

	preview.prepare(document, selection, selected.beforeText);
	await vscode.commands.executeCommand('editor.action.showHover');
}

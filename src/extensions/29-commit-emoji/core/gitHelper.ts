import * as vscode from 'vscode';
import type { API, GitExtension } from './git';

/**
 * Returns the VS Code Git Extension API (v1), or `undefined` when the
 * Git extension is unavailable or disabled.
 */
export function getGitExtension(): API | undefined {
	const vscodeGit = vscode.extensions.getExtension<GitExtension>('vscode.git');
	const gitExtension = vscodeGit && vscodeGit.exports;
	return gitExtension ? gitExtension.getAPI(1) : undefined;
}

/**
 * Focuses the SCM view and, if `index` is provided, navigates to the commit
 * input box of the repository at that index.
 *
 * Compatibility: gracefully ignores older VS Code builds that lack
 * `workbench.scm.action.focusNextInput`.
 */
export async function focusScmInputForRepoIndex(index?: number): Promise<void> {
	try {
		await vscode.commands.executeCommand('workbench.scm.focus');
	} catch { /* ignore */ }

	if (index === undefined) {return;}

	try {
		// First call moves focus to the first commit input; each subsequent
		// call advances by one, reaching the target repository.
		for (let i = 0; i <= index; i++) {
			await vscode.commands.executeCommand('workbench.scm.action.focusNextInput');
		}
	} catch { /* ignore */ }
}

/**
 * Inserts `valueToAdd` at the current cursor position when the active editor
 * is a git-commit editor (language id `git-commit` or filename `COMMIT_EDITMSG`).
 *
 * Automatically pads with spaces when adjacent characters are non-whitespace.
 * Returns `false` when the active editor is not a commit editor; the caller
 * should then fall back to SCM input logic.
 */
export async function tryInsertIntoCommitEditor(valueToAdd: string): Promise<boolean> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {return false;}

	const doc = editor.document;
	const isCommitEditor =
		doc.languageId === 'git-commit' || /COMMIT_EDITMSG$/i.test(doc.fileName);
	if (!isCommitEditor) {return false;}

	const pos = editor.selection.active;
	const lineText = doc.lineAt(pos.line).text;
	const beforeChar = pos.character > 0 ? lineText[pos.character - 1] : undefined;
	const afterChar = pos.character < lineText.length ? lineText[pos.character] : undefined;

	const needsPrefixSpace = beforeChar !== undefined && !/\s/.test(beforeChar);
	const needsSuffixSpace = afterChar !== undefined && !/\s/.test(afterChar);
	const insertText =
		(needsPrefixSpace ? ' ' : '') + valueToAdd + (needsSuffixSpace ? ' ' : '');

	const success = await editor.edit((edit) => {
		if (!editor.selection.isEmpty) {edit.delete(editor.selection);}
		edit.insert(pos, insertText);
	});

	if (success) {
		const newPos = pos.translate(0, insertText.length);
		editor.selection = new vscode.Selection(newPos, newPos);
	}
	return success;
}

/**
 * Types `valueToAdd` (with surrounding spaces) into the currently focused
 * SCM input box via VS Code's `type` command.
 *
 * The caller must ensure the correct SCM input is already focused.
 * Returns `false` when the `type` command is unavailable.
 */
export async function tryTypeIntoScmInput(valueToAdd: string): Promise<boolean> {
	try {
		await vscode.commands.executeCommand('type', { text: ` ${valueToAdd} ` });
		return true;
	} catch {
		return false;
	}
}

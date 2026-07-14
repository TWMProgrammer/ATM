import * as vscode from 'vscode';

export const COPY_COMMAND_ID = 'atm.beforeAfter.copyBefore';
export const RESTORE_COMMAND_ID = 'atm.beforeAfter.restoreBefore';

interface PreviewSnapshot {
	id: string;
	uri: vscode.Uri;
	version: number;
	range: vscode.Range;
	currentText: string;
	beforeText: string;
	languageId: string;
}

const MAX_SNAPSHOTS = 20;

export class BeforePreviewController implements vscode.HoverProvider {
	private readonly snapshots = new Map<string, PreviewSnapshot>();
	private pending: PreviewSnapshot | undefined;
	private sequence = 0;

	prepare(document: vscode.TextDocument, selection: vscode.Selection, beforeText: string): void {
		const snapshot: PreviewSnapshot = {
			id: String(++this.sequence),
			uri: document.uri,
			version: document.version,
			range: new vscode.Range(selection.start, selection.end),
			currentText: document.getText(selection),
			beforeText,
			languageId: document.languageId
		};
		this.pending = snapshot;
		this.snapshots.set(snapshot.id, snapshot);
		if (this.snapshots.size > MAX_SNAPSHOTS) {
			const oldest = this.snapshots.keys().next().value;
			if (oldest) {
				this.snapshots.delete(oldest);
			}
		}
	}

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
		const snapshot = this.pending;
		if (!snapshot || snapshot.uri.toString() !== document.uri.toString() || !snapshot.range.contains(position)) {
			return undefined;
		}
		this.pending = undefined;

		const markdown = new vscode.MarkdownString(undefined, true);
		markdown.isTrusted = { enabledCommands: [COPY_COMMAND_ID, RESTORE_COMMAND_ID] };
		markdown.supportThemeIcons = true;
		markdown.appendMarkdown(`**$(history) ${vscode.l10n.t('Before this change')}**\n\n`);
		markdown.appendCodeblock(
			snapshot.beforeText || vscode.l10n.t('(The selected code was newly added.)'),
			/^[-\w]+$/.test(snapshot.languageId) ? snapshot.languageId : ''
		);

		const args = encodeURIComponent(JSON.stringify([snapshot.id]));
		const actions: string[] = [];
		if (snapshot.beforeText) {
			actions.push(`[$(copy) ${vscode.l10n.t('Copy')}](command:${COPY_COMMAND_ID}?${args})`);
		}
		actions.push(`[$(discard) ${vscode.l10n.t('Restore selection')}](command:${RESTORE_COMMAND_ID}?${args})`);
		markdown.appendMarkdown(`\n${actions.join(' &nbsp; | &nbsp; ')}`);
		return new vscode.Hover(markdown, snapshot.range);
	}

	async copy(snapshotId: string): Promise<void> {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot) {
			return;
		}
		await vscode.env.clipboard.writeText(snapshot.beforeText);
		vscode.window.setStatusBarMessage(vscode.l10n.t('Previous code copied.'), 2000);
	}

	async restore(snapshotId: string): Promise<void> {
		const snapshot = this.snapshots.get(snapshotId);
		if (!snapshot) {
			return;
		}
		const document = vscode.workspace.textDocuments.find(
			(candidate) => candidate.uri.toString() === snapshot.uri.toString()
		);
		if (!document || document.version !== snapshot.version || document.getText(snapshot.range) !== snapshot.currentText) {
			void vscode.window.showWarningMessage(vscode.l10n.t('The selection changed. Select it again to restore safely.'));
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		edit.replace(snapshot.uri, snapshot.range, snapshot.beforeText);
		if (!await vscode.workspace.applyEdit(edit)) {
			void vscode.window.showErrorMessage(vscode.l10n.t('Could not restore the selected code.'));
			return;
		}

		this.snapshots.delete(snapshotId);
		const editor = vscode.window.visibleTextEditors.find(
			(candidate) => candidate.document.uri.toString() === snapshot.uri.toString()
		);
		if (editor) {
			const end = endPosition(snapshot.range.start, snapshot.beforeText);
			editor.selection = new vscode.Selection(snapshot.range.start, end);
			editor.revealRange(new vscode.Range(snapshot.range.start, end));
		}
	}
}

function endPosition(start: vscode.Position, text: string): vscode.Position {
	const lines = text.split(/\r?\n/);
	if (lines.length === 1) {
		return start.translate(0, lines[0].length);
	}
	return new vscode.Position(start.line + lines.length - 1, lines[lines.length - 1].length);
}

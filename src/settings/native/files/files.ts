import * as vscode from 'vscode';

/**
 * Activa configuraciones nativas de archivos de VS Code.
 * - Desactiva 'explorer.compactFolders'.
*/
export async function activateFilesSettings() {
	const explorerConfig = vscode.workspace.getConfiguration('explorer');

	if (explorerConfig.get<boolean>('compactFolders') !== false) {
		await explorerConfig.update(
			'compactFolders',
			false,
			vscode.ConfigurationTarget.Global,
		);
	}
}

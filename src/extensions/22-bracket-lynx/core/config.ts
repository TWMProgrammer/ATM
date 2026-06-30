import * as vscode from 'vscode';
import { CONFIG_SECTION } from './constants';

export function getConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function isGlobalEnabled(): boolean {
	return getConfig().get('globalEnabled', true);
}

import * as vscode from 'vscode';
import { CONFIG_SECTION } from '../core/constants';
import { getConfig, isGlobalEnabled } from '../core/config';

const GLOBAL_ENABLED_KEY = 'globalEnabled';

let context: vscode.ExtensionContext | undefined;

export function initializeToggleState(extensionContext: vscode.ExtensionContext): void {
	context = extensionContext;
}

export function isExtensionEnabled(): boolean {
	return isGlobalEnabled();
}

export async function toggleGlobal(): Promise<void> {
	const config = getConfig();
	const current = isGlobalEnabled();
	await config.update(GLOBAL_ENABLED_KEY, !current, vscode.ConfigurationTarget.Global);

	vscode.window.showInformationMessage(
		current ? 'Bracket Lynx disabled ❌' : 'Bracket Lynx enabled ✅',
	);
}

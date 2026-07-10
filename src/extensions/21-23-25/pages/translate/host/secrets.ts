import * as vscode from 'vscode';
import { translationSecretKeys } from '../core/translationService';

const setDeepLApiKeyCommand = 'atm.translate.setDeepLApiKey';
const setGoogleCloudApiKeyCommand = 'atm.translate.setGoogleCloudApiKey';
const setLibreTranslateApiKeyCommand = 'atm.translate.setLibreTranslateApiKey';
const clearTranslationApiKeysCommand = 'atm.translate.clearApiKeys';

export function registerSecretCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(setDeepLApiKeyCommand, async () => {
			await promptAndStoreSecret(context, translationSecretKeys.deepLApiKey, 'DeepL API key');
		}),
		vscode.commands.registerCommand(setGoogleCloudApiKeyCommand, async () => {
			await promptAndStoreSecret(context, translationSecretKeys.googleCloudApiKey, 'Google Cloud Translation API key');
		}),
		vscode.commands.registerCommand(setLibreTranslateApiKeyCommand, async () => {
			await promptAndStoreSecret(context, translationSecretKeys.libreTranslateApiKey, 'LibreTranslate API key');
		}),
		vscode.commands.registerCommand(clearTranslationApiKeysCommand, async () => {
			const confirmation = await vscode.window.showWarningMessage(
				vscode.l10n.t('Clear stored ATM Translate API keys?'),
				{ modal: true },
				'Clear',
			);
			if (confirmation !== 'Clear') { return; }

			await Promise.all(Object.values(translationSecretKeys).map((key) => context.secrets.delete(key)));
			await vscode.window.showInformationMessage(vscode.l10n.t('ATM Translate API keys cleared.'));
		}),
	);
}

async function promptAndStoreSecret(
	context: vscode.ExtensionContext,
	key: string,
	label: string,
): Promise<void> {
	const value = await vscode.window.showInputBox({
		title: `ATM Translate: Set ${label}`,
		prompt: `Paste your ${label}. It will be stored in VS Code SecretStorage.`,
		password: true,
		ignoreFocusOut: true,
		placeHolder: 'API key',
	});

	if (value === undefined) { return; }
	const cleanValue = value.trim();
	if (!cleanValue) {
		await context.secrets.delete(key);
		await vscode.window.showInformationMessage(vscode.l10n.t('ATM Translate {0} cleared.', label));
		return;
	}

	await context.secrets.store(key, cleanValue);
	await vscode.window.showInformationMessage(vscode.l10n.t('ATM Translate {0} saved.', label));
}

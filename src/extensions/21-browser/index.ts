import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { correctPlainText, translatePlainText, translationSecretKeys } from './core/translator';
import { languages } from './ui/flags';

const translatorPanelViewType = 'atm.translator';
const openTranslatorCommand = 'atm.browser.open';
const setDeepLApiKeyCommand = 'atm.translate.setDeepLApiKey';
const setGoogleCloudApiKeyCommand = 'atm.translate.setGoogleCloudApiKey';
const setLibreTranslateApiKeyCommand = 'atm.translate.setLibreTranslateApiKey';
const clearTranslationApiKeysCommand = 'atm.translate.clearApiKeys';
const maxTextLength = 5000;
const languageCodes = new Set(languages.map((language) => language.code));

let activePanel: vscode.WebviewPanel | undefined;
let activeAbortController: AbortController | undefined;
let activeSpellcheckAbortController: AbortController | undefined;

interface TranslateMessage {
	type: 'translate';
	id: string;
	text: string;
	from: string;
	to: string;
}

interface CopyMessage {
	type: 'copy';
	text: string;
}

interface SpellcheckMessage {
	type: 'spellcheck';
	text: string;
	language: string;
}

type WebviewMessage = unknown;

export function activateBrowser(context: vscode.ExtensionContext): void {
	registerSecretCommands(context);

	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(translatorPanelViewType, {
			async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { text?: string }) {
				setupPanel(panel, context, state?.text);
			},
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(openTranslatorCommand, (text?: string) => {
			const initialText = getInitialText(text);

			if (activePanel) {
				activePanel.reveal(vscode.ViewColumn.Active);
				if (initialText) {
					activePanel.webview.postMessage({ type: 'setText', text: initialText });
				}
				return;
			}

			const panel = vscode.window.createWebviewPanel(
				translatorPanelViewType,
				'ATM Translate',
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'dist'),
						vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'assets'),
					],
				}
			);

			setupPanel(panel, context, initialText);
		})
	);
}

function setupPanel(
	panel: vscode.WebviewPanel,
	context: vscode.ExtensionContext,
	initialText?: string,
): void {
	panel.iconPath = vscode.Uri.joinPath(
		context.extensionUri, 'src', 'extensions', '21-browser', 'assets', 'atm-logo.png'
	);

	panel.webview.html = getTranslatorHtml(context, panel.webview);
	activePanel = panel;
	const panelDisposables: vscode.Disposable[] = [];

	if (initialText) {
		setTimeout(() => {
			panel.webview.postMessage({ type: 'setText', text: initialText });
		}, 150);
	}

	panel.webview.onDidReceiveMessage(
		async (message: WebviewMessage) => {
			if (isTranslateMessage(message)) {
				await handleTranslateMessage(panel, message, context.secrets);
				return;
			}

			if (isCopyMessage(message)) {
				await vscode.env.clipboard.writeText(message.text);
				return;
			}

			if (isSpellcheckMessage(message)) {
				await handleSpellcheckMessage(panel, message, context.secrets);
			}
		},
		undefined,
		panelDisposables,
	);

	panel.onDidDispose(() => {
		activeAbortController?.abort();
		activeAbortController = undefined;
		activeSpellcheckAbortController?.abort();
		activeSpellcheckAbortController = undefined;

		if (activePanel === panel) {
			activePanel = undefined;
		}

		vscode.Disposable.from(...panelDisposables).dispose();
	}, undefined, context.subscriptions);
}

function registerSecretCommands(context: vscode.ExtensionContext): void {
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
				'Clear stored ATM Translate API keys?',
				{ modal: true },
				'Clear',
			);
			if (confirmation !== 'Clear') { return; }

			await Promise.all(Object.values(translationSecretKeys).map((key) => context.secrets.delete(key)));
			await vscode.window.showInformationMessage('ATM Translate API keys cleared.');
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
		await vscode.window.showInformationMessage(`ATM Translate ${label} cleared.`);
		return;
	}

	await context.secrets.store(key, cleanValue);
	await vscode.window.showInformationMessage(`ATM Translate ${label} saved.`);
}

async function handleTranslateMessage(
	panel: vscode.WebviewPanel,
	message: TranslateMessage,
	secrets: vscode.SecretStorage,
): Promise<void> {
	const validationError = validateTranslatePayload(message.text, message.from, message.to);
	if (validationError) {
		await panel.webview.postMessage({
			type: 'translationError',
			id: message.id,
			message: validationError,
		});
		return;
	}

	activeAbortController?.abort();
	const controller = new AbortController();
	activeAbortController = controller;

	try {
		const result = await translatePlainText(
			{
				text: message.text,
				from: message.from,
				to: message.to,
				signal: controller.signal,
			},
			secrets,
		);

		await panel.webview.postMessage({
			type: 'translated',
			id: message.id,
			text: result.text,
			provider: result.providerName,
			fromCache: result.fromCache,
		});
	} catch (error) {
		if (controller.signal.aborted) { return; }

		await panel.webview.postMessage({
			type: 'translationError',
			id: message.id,
			message: error instanceof Error ? error.message : 'Translation failed.',
		});
	} finally {
		if (activeAbortController === controller) {
			activeAbortController = undefined;
		}
	}
}

function isTranslateMessage(message: WebviewMessage): message is TranslateMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'translate'
		&& typeof message.id === 'string'
		&& typeof message.text === 'string'
		&& typeof message.from === 'string'
		&& typeof message.to === 'string';
}

function isCopyMessage(message: WebviewMessage): message is CopyMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'copy' && typeof message.text === 'string';
}

function isSpellcheckMessage(message: WebviewMessage): message is SpellcheckMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'spellcheck'
		&& typeof message.text === 'string'
		&& typeof message.language === 'string';
}

async function handleSpellcheckMessage(
	panel: vscode.WebviewPanel,
	message: SpellcheckMessage,
	secrets: vscode.SecretStorage,
): Promise<void> {
	const text = message.text.trim();
	if (!text) {
		await panel.webview.postMessage({ type: 'spellcheckResult', text: '' });
		return;
	}

	if (text.length > maxTextLength) {
		await panel.webview.postMessage({
			type: 'spellcheckResult',
			error: `Text is too long. Keep spelling checks under ${maxTextLength} characters.`,
		});
		return;
	}

	if (!isValidSourceLanguage(message.language)) {
		await panel.webview.postMessage({
			type: 'spellcheckResult',
			error: 'Unsupported spell check language.',
		});
		return;
	}

	activeSpellcheckAbortController?.abort();
	const controller = new AbortController();
	activeSpellcheckAbortController = controller;

	try {
		const result = await correctPlainText(
			{
				text,
				language: message.language,
				signal: controller.signal,
			},
			secrets,
		);

		await panel.webview.postMessage({
			type: 'spellcheckResult',
			text: result.text,
			provider: result.providerName,
			fromCache: result.fromCache,
		});
	} catch (error) {
		if (controller.signal.aborted) { return; }

		await panel.webview.postMessage({
			type: 'spellcheckResult',
			error: error instanceof Error ? error.message : 'Spell check failed.',
		});
	} finally {
		if (activeSpellcheckAbortController === controller) {
			activeSpellcheckAbortController = undefined;
		}
	}
}

function validateTranslatePayload(text: string, from: string, to: string): string | undefined {
	if (!text.trim()) { return undefined; }
	if (text.trim().length > maxTextLength) {
		return `Text is too long. Keep translations under ${maxTextLength} characters.`;
	}
	if (!isValidSourceLanguage(from)) {
		return 'Unsupported source language.';
	}
	if (!isValidTargetLanguage(to)) {
		return 'Unsupported target language.';
	}
	return undefined;
}

function isValidSourceLanguage(code: string): boolean {
	return languageCodes.has(code);
}

function isValidTargetLanguage(code: string): boolean {
	return code !== 'auto' && languageCodes.has(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getInitialText(text?: string): string {
	if (typeof text === 'string' && text.trim()) {
		return text;
	}

	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.selection.isEmpty) {
		return '';
	}

	return editor.document.getText(editor.selection).trim();
}

function getTranslatorHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'ui');
	const html   = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.html').fsPath, 'utf8');
	const css    = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.css').fsPath, 'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'browser.js')
	);

	const logoUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'assets', 'atm-logo.png')
	);

	const nonce = crypto.randomUUID().replace(/-/g, '');

	const csp = [
		`default-src 'none'`,
		`font-src ${webview.cspSource}`,
		`img-src ${webview.cspSource} data:`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	return html
		.replace('<!-- ATM_BROWSER_STYLES -->', `<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>${css}</style>`)
		.replace('<!-- ATM_BROWSER_SCRIPT -->', `<script src="${scriptUri}" nonce="${nonce}"></script>`)
		.replace('ATM_LOGO_SRC', logoUri.toString());
}

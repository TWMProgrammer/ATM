import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { translatePlainText } from './core/translator';

const translatorPanelViewType = 'atm.translator';
const openTranslatorCommand = 'atm.browser.open';

let activePanel: vscode.WebviewPanel | undefined;
let activeAbortController: AbortController | undefined;

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

	if (initialText) {
		setTimeout(() => {
			panel.webview.postMessage({ type: 'setText', text: initialText });
		}, 150);
	}

	panel.webview.onDidReceiveMessage(
		async (message: WebviewMessage) => {
			if (isTranslateMessage(message)) {
				await handleTranslateMessage(panel, message);
				return;
			}

			if (isCopyMessage(message)) {
				await vscode.env.clipboard.writeText(message.text);
				return;
			}

			if (isSpellcheckMessage(message)) {
				await handleSpellcheckMessage(panel, message);
			}
		},
		undefined,
		context.subscriptions,
	);

	panel.onDidDispose(() => {
		activeAbortController?.abort();
		activeAbortController = undefined;

		if (activePanel === panel) {
			activePanel = undefined;
		}
	}, undefined, context.subscriptions);
}

async function handleTranslateMessage(
	panel: vscode.WebviewPanel,
	message: TranslateMessage,
): Promise<void> {
	activeAbortController?.abort();
	const controller = new AbortController();
	activeAbortController = controller;

	try {
		const translatedText = await translatePlainText({
			text: message.text,
			from: message.from,
			to: message.to,
			signal: controller.signal,
		});

		await panel.webview.postMessage({
			type: 'translated',
			id: message.id,
			text: translatedText,
		});
	} catch (error) {
		if (controller.signal.aborted) { return; }

		await panel.webview.postMessage({
			type: 'translationError',
			id: message.id,
			message: error instanceof Error ? error.message : 'Translation failed.',
		});
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
): Promise<void> {
	try {
		const lang = message.language === 'auto' ? 'en' : message.language;
		const corrected = await translatePlainText({
			text: message.text,
			from: lang,
			to: lang,
		});

		await panel.webview.postMessage({
			type: 'spellcheckResult',
			text: corrected,
		});
	} catch (error) {
		await panel.webview.postMessage({
			type: 'spellcheckResult',
			error: error instanceof Error ? error.message : 'Spell check failed.',
		});
	}
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

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { handleWebviewMessage, abortActiveRequests } from './messageHandlers';

export const translatorPanelViewType = 'atm.translator';

let activePanel: vscode.WebviewPanel | undefined;

export function openTranslatorPanel(context: vscode.ExtensionContext, text?: string): void {
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
				vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-atm-translate', 'assets'),
			],
		}
	);

	setupTranslatorPanel(panel, context, initialText);
}

export function setupTranslatorPanel(
	panel: vscode.WebviewPanel,
	context: vscode.ExtensionContext,
	initialText?: string,
): void {
	panel.iconPath = vscode.Uri.joinPath(
		context.extensionUri, 'src', 'extensions', '21-atm-translate', 'assets', 'atm-logo.png'
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
		async (message: unknown) => {
			await handleWebviewMessage(panel, message, context);
		},
		undefined,
		panelDisposables,
	);

	panel.onDidDispose(() => {
		abortActiveRequests();

		if (activePanel === panel) {
			activePanel = undefined;
		}

		vscode.Disposable.from(...panelDisposables).dispose();
	}, undefined, context.subscriptions);
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
	const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-atm-translate', 'ui');
	const html   = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'atm-translate.html').fsPath, 'utf8');
	const css    = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'atm-translate.css').fsPath, 'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'atm-translate.js')
	);

	const logoUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-atm-translate', 'assets', 'atm-logo.png')
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


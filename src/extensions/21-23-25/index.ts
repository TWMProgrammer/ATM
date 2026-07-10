import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { activateGitCommands } from './pages/git-commands';
import { activateAtmTranslate } from './pages/translate';
import { activateCompareCode, deactivateCompareCode } from './pages/compare-code';

export { activateGitCommands, activateAtmTranslate, activateCompareCode, deactivateCompareCode };

type LaunchAction = 'browser' | 'compare' | 'translate' | 'git';

const launchCommands: Record<LaunchAction, string> = {
	browser: 'atm.browser.open',
	compare: 'atm.compareCode.open',
	translate: 'atm.translate.open',
	git: 'atm.gitCommands.open',
};

export function activateIra(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('atm.ira.open', () => {
		const panel = vscode.window.createWebviewPanel(
			'atmIra',
			'ATM IRA',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'ui'),
					vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'assets'),
					vscode.Uri.joinPath(context.extensionUri, 'dist'),
				],
			}
		);

		panel.iconPath = vscode.Uri.file(
			context.asAbsolutePath('src/assets/atm-logo.png')
		);

		vscode.commands.executeCommand('setContext', 'atm.ira.active', true);

		const panelDisposables: vscode.Disposable[] = [];

		panel.onDidChangeViewState(e => {
			vscode.commands.executeCommand('setContext', 'atm.ira.active', e.webviewPanel.active);
		});

		panel.onDidDispose(() => {
			vscode.commands.executeCommand('setContext', 'atm.ira.active', false);
			vscode.Disposable.from(...panelDisposables).dispose();
		});

		panel.webview.html = getWebviewContent(context, panel.webview);

		panel.webview.onDidReceiveMessage(
			(message: unknown) => handleWebviewMessage(panel, message),
			undefined,
			panelDisposables,
		);
	});

	context.subscriptions.push(disposable);
}

function handleWebviewMessage(panel: vscode.WebviewPanel, message: unknown): void {
	if (!message || typeof message !== 'object') {
		return;
	}

	const msg = message as { type?: unknown; action?: unknown };
	if (msg.type !== 'launch') {
		return;
	}

	const action = msg.action;
	if (action !== 'browser' && action !== 'compare' && action !== 'translate' && action !== 'git') {
		return;
	}

	vscode.commands.executeCommand(launchCommands[action]);
	panel.dispose();
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'ui');
	const assetsRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'assets');
	const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ira.html').fsPath, 'utf8');
	const css = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'ira.css').fsPath, 'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'ira.js')
	);

	const nonce = crypto.randomUUID().replace(/-/g, '');

	const csp = [
		`default-src 'none'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	const browserIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'browser.svg').fsPath);
	const compareIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'compare-code.svg').fsPath);
	const translateIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'translate.svg').fsPath);
	const gitIcon = inlineSvg(vscode.Uri.joinPath(assetsRoot, 'git.svg').fsPath);

	return html
		.replace('<!-- ATM_IRA_STYLES -->', `<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>\n${css}\n\t</style>`)
		.replace('<!-- ATM_IRA_SCRIPT -->', `<script src="${scriptUri}" nonce="${nonce}"></script>`)
		.replace('<!-- ATM_IRA_ICON_BROWSER -->', browserIcon)
		.replace('<!-- ATM_IRA_ICON_COMPARE -->', compareIcon)
		.replace('<!-- ATM_IRA_ICON_TRANSLATE -->', translateIcon)
		.replace('<!-- ATM_IRA_ICON_GIT -->', gitIcon);
}

function inlineSvg(filePath: string): string {
	return fs.readFileSync(filePath, 'utf8').replace(/<style[\s\S]*?<\/style>/gi, '');
}

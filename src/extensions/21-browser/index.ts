import * as fs from 'fs';
import * as vscode from 'vscode';

const browserPanelViewType = 'atm.browser';

export function activateBrowser(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('atm.browser.open', () => {
			const panel = vscode.window.createWebviewPanel(
				browserPanelViewType,
				'ATM Browser',
				vscode.ViewColumn.Active,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'dist'),
					],
				}
			);

			panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'ui', 'globe.svg');
			panel.webview.html = getBrowserHtml(context, panel.webview);
		})
	);
}

function getBrowserHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'ui');
	const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.html').fsPath, 'utf8');
	const css = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.css').fsPath, 'utf8');
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'browser.js'));

	return html
		.replace('<!-- ATM_BROWSER_STYLES -->', `<style>${css}</style>`)
		.replace('<!-- ATM_BROWSER_SCRIPT -->', `<script src="${scriptUri}"></script>`);
}

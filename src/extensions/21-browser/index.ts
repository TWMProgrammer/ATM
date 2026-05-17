import * as fs from 'fs';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

const browserPanelViewType = 'atm.browser';

// ── Singleton panel ──────────────────────────────────────────────────────────
let activePanel: vscode.WebviewPanel | undefined;

export function activateBrowser(context: vscode.ExtensionContext): void {
	// Restore panel when VS Code restarts (user had the panel open before)
	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(browserPanelViewType, {
			async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { url?: string }) {
				setupPanel(panel, context, state?.url);
			},
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('atm.browser.open', (url?: string) => {
			if (activePanel) {
				// Reuse the existing panel instead of opening a duplicate
				activePanel.reveal(vscode.ViewColumn.Active);
				if (url) {
					activePanel.webview.postMessage({ type: 'navigate', url });
				}
				return;
			}

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

			setupPanel(panel, context, url);
		})
	);
}

// ── Panel setup (shared between new + restored panels) ───────────────────────
function setupPanel(
	panel: vscode.WebviewPanel,
	context: vscode.ExtensionContext,
	initialUrl?: string,
): void {
	panel.iconPath = vscode.Uri.joinPath(
		context.extensionUri, 'src', 'extensions', '21-browser', 'assets', 'globe.svg'
	);

	panel.webview.html = getBrowserHtml(context, panel.webview);
	activePanel = panel;

	// Navigate to initial URL if provided
	if (initialUrl) {
		// Small delay so the webview script has time to initialize
		setTimeout(() => {
			panel.webview.postMessage({ type: 'navigate', url: initialUrl });
		}, 300);
	}

	// Messages from the webview → extension host
	panel.webview.onDidReceiveMessage(
		(message: { type: string; url?: string }) => {
			if (message.type === 'openExternal' && message.url) {
				try {
					vscode.env.openExternal(vscode.Uri.parse(message.url));
				} catch {
					// noop — invalid URI
				}
			}
		},
		undefined,
		context.subscriptions,
	);

	panel.onDidDispose(() => {
		if (activePanel === panel) {
			activePanel = undefined;
		}
	}, undefined, context.subscriptions);
}

// ── HTML generation ───────────────────────────────────────────────────────────
function getBrowserHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-browser', 'ui');
	const html   = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.html').fsPath, 'utf8');
	const css    = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'browser.css').fsPath, 'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'browser.js')
	);

	// Nonce for CSP — unique per panel instantiation
	const nonce = crypto.randomUUID().replace(/-/g, '');

	const csp = [
		`default-src 'none'`,
		`font-src data:`,
		`img-src ${webview.cspSource} https: data:`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src 'nonce-${nonce}'`,
		`connect-src *`,
		`media-src *`,
		`frame-src *`,
	].join('; ');

	return html
		.replace('<!-- ATM_BROWSER_STYLES -->', `<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>${css}</style>`)
		.replace('<!-- ATM_BROWSER_SCRIPT -->', `<script src="${scriptUri}" nonce="${nonce}"></script>`);
}

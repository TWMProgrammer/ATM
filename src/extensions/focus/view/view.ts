import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { handleWebviewMessage } from '../screens/atm-music/shared/server/handler';
import { openScreenshotPanel, refreshScreenshotPanelData } from '../screens/atm-data/screenshot/screenshot';
import { ATMDataProvider } from '../screens/atm-data/core/provider';

export class YouTubeMusicViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atm-yt-music-view';

	private _view?: vscode.WebviewView;
	private _cachedRawHtml: string | null = null;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		ATMDataProvider.getInstance().setWebview(webviewView);

		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.type === 'open_screenshot') {
				openScreenshotPanel(this._extensionUri, message.payload, (isOpen: boolean) => {
					webviewView.webview.postMessage({ type: 'screenshot_state_changed', isOpen });
				});
				return;
			}
			if (message.type === 'refresh_screenshot') {
				const refreshed = await refreshScreenshotPanelData(message.payload);
				if (!refreshed) {
					openScreenshotPanel(this._extensionUri, message.payload, (isOpen: boolean) => {
						webviewView.webview.postMessage({ type: 'screenshot_state_changed', isOpen });
					});
				}
				return;
			}
			if (message.type === 'nickname_updated') {
				ATMDataProvider.getInstance().setNickname(message.nickname);
				refreshScreenshotPanelData({ nickname: message.nickname });
				return;
			}
			if (message.type === 'request_stats_update') {
				ATMDataProvider.getInstance().dispatchUpdate();
				return;
			}
			handleWebviewMessage(webviewView, message);
		});
	}

	public togglePlayPause() {
		this._view?.webview.postMessage({ type: 'togglePlayPause' });
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Asset paths
		const styles = [
			['src', 'extensions', 'focus', 'view', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-music', 'music', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'index.css'],
		];

		const styleUris = styles.map(s => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...s)));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'atm-music-webview.js'));

		const csp = [
			`default-src 'none'`,
			`connect-src http://127.0.0.1:*`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource}`,
			`img-src ${webview.cspSource} https://*.ytimg.com https://*.googleusercontent.com https://*.dzcdn.net https://*.fastly.net data:`,
			`media-src ${webview.cspSource} https://*.dzcdn.net http://127.0.0.1:* blob: data:`,
			`font-src ${webview.cspSource}`,
		].join('; ');

		// Read and assemble the raw template once, cache for subsequent resolves.
		// These files are part of the extension bundle and never change at runtime.
		if (!this._cachedRawHtml) {
			const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'view', 'ui', 'index.html');
			let rawHtml = fs.readFileSync(htmlPath, 'utf8');

			const timeHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.html');
			const timeHtml = fs.readFileSync(timeHtmlPath, 'utf8');
			rawHtml = rawHtml.replace('<div id="atm-time-root"></div>', `<div id="atm-time-root">\n${timeHtml}\n</div>`);

			const dataHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'index.html');
			const dataHtml = fs.readFileSync(dataHtmlPath, 'utf8');
			rawHtml = rawHtml.replace('<div id="atm-data-root" class="center-screen-message"></div>', `\n${dataHtml}\n`);

			this._cachedRawHtml = rawHtml;
		}

		// Inject dynamic webview-specific parts (CSP + URIs change per webview instance)
		let html = this._cachedRawHtml;

		const styleLinks = styleUris.map(uri => `<link rel="stylesheet" href="${uri}">`).join('\n');

		html = html.replace(
			'</head>',
			`<meta http-equiv="Content-Security-Policy" content="${csp}">\n${styleLinks}\n</head>`,
		);
		html = html.replace('</body>', `<script src="${scriptUri}"></script>\n</body>`);

		return html;
	}
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { handleWebviewMessage } from '../screens/atm-music/music';
import { openScreenshotPanel } from '../screens/atm-data/screenshot/screenshot';

export class YouTubeMusicViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atm-yt-music-view';

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.type === 'open_screenshot') {
				openScreenshotPanel(this._extensionUri, message.payload);
				return;
			}
			handleWebviewMessage(webviewView, message);
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Asset paths
		const styles = [
			['src', 'extensions', 'focus', 'view', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-music', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.css'],
			['src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'layout.css'],
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

		const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'view', 'ui', 'index.html');
		let html = fs.readFileSync(htmlPath, 'utf8');

		const timeHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.html');
		const timeHtml = fs.readFileSync(timeHtmlPath, 'utf8');
		html = html.replace('<div id="atm-time-root"></div>', `<div id="atm-time-root">\n${timeHtml}\n</div>`);

		const dataHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'layout.html');
		const dataHtml = fs.readFileSync(dataHtmlPath, 'utf8');
		html = html.replace('<div id="atm-data-root" class="center-screen-message"></div>', `\n${dataHtml}\n`);

		const styleLinks = styleUris.map(uri => `<link rel="stylesheet" href="${uri}">`).join('\n');

		html = html.replace(
			'</head>',
			`<meta http-equiv="Content-Security-Policy" content="${csp}">\n${styleLinks}\n</head>`,
		);
		html = html.replace('</body>', `<script src="${scriptUri}"></script>\n</body>`);

		return html;
	}
}

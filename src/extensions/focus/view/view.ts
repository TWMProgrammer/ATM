import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { handleWebviewMessage } from '../screens/atm-music/shared/server/handler';
import { openScreenshotPanel, refreshScreenshotPanelData } from '../screens/atm-data/screenshot/screenshot';
import { ATMDataProvider } from '../screens/atm-data/core/provider';

interface PersistedFavoriteStation {
	id: string;
	title: string;
	streamUrl: string;
	originalStationKey: string;
}

export class YouTubeMusicViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atm-yt-music-view';
	private static readonly FAVORITES_STORAGE_KEY = 'focus.atmMusic.favorites.v1';
	private static readonly FAVORITES_MAX_SLOTS = 3;

	private _view?: vscode.WebviewView;
	private _cachedRawHtml: string | null = null;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
	) { }

	private _normalizeFavoriteStation(entry: unknown): PersistedFavoriteStation | null {
		if (!entry || typeof entry !== 'object') {
			return null;
		}

		const record = entry as Record<string, unknown>;
		const id = typeof record.id === 'string' ? record.id.trim() : '';
		const title = typeof record.title === 'string' ? record.title.trim() : '';
		const streamUrl = typeof record.streamUrl === 'string'
			? record.streamUrl.trim()
			: (typeof record.preview === 'string' ? record.preview.trim() : '');
		const originalStationKey = typeof record.originalStationKey === 'string'
			? record.originalStationKey.trim()
			: '';

		if (!id || !streamUrl || !originalStationKey) {
			return null;
		}

		return {
			id,
			title: title || 'AM',
			streamUrl,
			originalStationKey,
		};
	}

	private _sanitizeFavoritesState(value: unknown): Array<PersistedFavoriteStation | null> {
		const raw = Array.isArray(value) ? value : [];
		const seenIds = new Set<string>();
		const normalized: Array<PersistedFavoriteStation | null> = [];

		for (const item of raw) {
			if (normalized.length >= YouTubeMusicViewProvider.FAVORITES_MAX_SLOTS) {
				break;
			}

			const favorite = this._normalizeFavoriteStation(item);
			if (!favorite || seenIds.has(favorite.id)) {
				normalized.push(null);
				continue;
			}

			seenIds.add(favorite.id);
			normalized.push(favorite);
		}

		while (normalized.length < YouTubeMusicViewProvider.FAVORITES_MAX_SLOTS) {
			normalized.push(null);
		}

		return normalized;
	}

	private async _sendFavoritesState(webview: vscode.Webview): Promise<void> {
		const stored = this._context.globalState.get<unknown>(YouTubeMusicViewProvider.FAVORITES_STORAGE_KEY);
		const favorites = this._sanitizeFavoritesState(stored);
		await webview.postMessage({
			type: 'atm_music_favorites_state',
			favorites,
		});
	}

	private async _saveFavoritesState(value: unknown): Promise<void> {
		const favorites = this._sanitizeFavoritesState(value);
		const hasAnyFavorite = favorites.some((entry) => entry !== null);

		await this._context.globalState.update(
			YouTubeMusicViewProvider.FAVORITES_STORAGE_KEY,
			hasAnyFavorite ? favorites : undefined,
		);
	}

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
			if (message.type === 'atm_music_favorites_load') {
				await this._sendFavoritesState(webviewView.webview);
				return;
			}
			if (message.type === 'atm_music_favorites_save') {
				await this._saveFavoritesState(message.favorites);
				return;
			}
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

	public playRandomAM() {
		this._view?.webview.postMessage({ type: 'playRandomAM' });
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'atm-music-webview.js'));

		const csp = [
			`default-src 'none'`,
			`connect-src http://127.0.0.1:*`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src ${webview.cspSource} 'unsafe-inline'`,
			`img-src ${webview.cspSource} https://*.ytimg.com https://*.googleusercontent.com https://*.dzcdn.net https://*.fastly.net data:`,
			`media-src ${webview.cspSource} https://*.dzcdn.net http://127.0.0.1:* blob: data:`,
			`font-src ${webview.cspSource}`,
		].join('; ');

		// Read and assemble the raw template once, cache for subsequent resolves.
		// These files are part of the extension bundle and never change at runtime.
		if (!this._cachedRawHtml) {
			const stylesPaths = [
				['src', 'extensions', 'focus', 'view', 'ui', 'index.css'],
				['src', 'extensions', 'focus', 'screens', 'atm-music', 'music', 'ui', 'index.css'],
				['src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.css'],
				['src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'index.css'],
			];

			let combinedCss = '';
			for (const s of stylesPaths) {
				const cssPath = path.join(this._extensionUri.fsPath, ...s);
				if (fs.existsSync(cssPath)) {
					combinedCss += fs.readFileSync(cssPath, 'utf8') + '\n';
				}
			}

			const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'view', 'ui', 'index.html');
			let rawHtml = fs.readFileSync(htmlPath, 'utf8');

			const timeHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-time', 'ui', 'index.html');
			const timeHtml = fs.readFileSync(timeHtmlPath, 'utf8');
			rawHtml = rawHtml.replace('<div id="atm-time-root"></div>', `<div id="atm-time-root">\n${timeHtml}\n</div>`);

			const dataHtmlPath = path.join(this._extensionUri.fsPath, 'src', 'extensions', 'focus', 'screens', 'atm-data', 'ui', 'index.html');
			const dataHtml = fs.readFileSync(dataHtmlPath, 'utf8');
			rawHtml = rawHtml.replace('<div id="atm-data-root" class="center-screen-message"></div>', `\n${dataHtml}\n`);

			rawHtml = rawHtml.replace('</head>', `<style>\n${combinedCss}</style>\n</head>`);

			this._cachedRawHtml = rawHtml;
		}

		// Inject dynamic webview-specific parts (CSP + URIs change per webview instance)
		let html = this._cachedRawHtml;

		html = html.replace(
			'</head>',
			`<meta http-equiv="Content-Security-Policy" content="${csp}">\n</head>`,
		);
		html = html.replace('</body>', `<script src="${scriptUri}"></script>\n<script>\nsetTimeout(() => document.body.classList.remove('is-app-loading'), 50);\n</script>\n</body>`);

		return html;
	}
}

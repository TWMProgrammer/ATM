import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { WebviewMessage } from '../../../shared/types';
import { providerManager } from './providers/provider-manager';

let streamServer: http.Server | null = null;
let streamPort = 0;

export function startAudioServer(): Promise<number> {
    if (streamServer && streamPort > 0) {return Promise.resolve(streamPort);}

    streamServer = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url || '', `http://${req.headers.host || '127.0.0.1'}`);
            if (url.pathname === '/stream') {
                const videoId = url.searchParams.get('videoId');
                const provider = url.searchParams.get('provider') || 'netease';
                if (!videoId) {
                    res.writeHead(400);
                    return res.end('Missing videoId');
                }

                // Restrict CORS to VS Code webview origins only
                const origin = req.headers.origin || '';
                const allowedOrigin = origin.startsWith('vscode-webview://') ? origin : 'null';
                res.setHeader('Access-Control-Allow-Origin', allowedOrigin);

                // Handle CORS preflight
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Range');
                    res.writeHead(204);
                    return res.end();
                }

                // Get true authorized streaming URL
                const realUrl = await providerManager.getStreamUrl(provider, videoId);

                if (!realUrl) {
                    res.writeHead(404);
                    return res.end('Track unavailable');
                }

                // Forward the Range header so seeking works (206 Partial Content)
                const upstreamHeaders: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                };
                
                if (provider === 'netease') {
                    upstreamHeaders['Referer'] = 'https://music.163.com/';
                    upstreamHeaders['Cookie'] = 'os=pc; osver=Microsoft-Windows-10-Professional-build-19041-64bit; appver=2.9.0;';
                }

                if (req.headers.range) {
                    upstreamHeaders['Range'] = req.headers.range;
                }

                const protocol = realUrl.startsWith('https') ? https : http;
                protocol.get(realUrl, { headers: upstreamHeaders }, (streamRes) => {
                    const outHeaders: Record<string, string | string[]> = {
                        'Content-Type': streamRes.headers['content-type'] || 'audio/mpeg',
                        'Accept-Ranges': 'bytes',
                    };

                    // Pass through seek-critical headers
                    if (streamRes.headers['content-length']) {
                        outHeaders['Content-Length'] = streamRes.headers['content-length'];
                    }
                    if (streamRes.headers['content-range']) {
                        outHeaders['Content-Range'] = streamRes.headers['content-range'];
                    }

                    // Handle redirects
                    if (streamRes.statusCode && streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
                        res.writeHead(streamRes.statusCode, { 'Location': streamRes.headers.location });
                        return res.end();
                    }

                    res.writeHead(streamRes.statusCode || 200, outHeaders);
                    streamRes.pipe(res);
                }).on('error', (e) => {
                    console.error('[ATM Music] Pipe error:', e);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end();
                    }
                });

            } else {
                res.writeHead(404);
                res.end();
            }
        } catch (err) {
            console.error('[ATM Music] Stream error:', err);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end();
            }
        }
    });

    return new Promise((resolve) => {
        streamServer!.listen(0, '127.0.0.1', () => {
            const addr = streamServer?.address();
            if (addr && typeof addr !== 'string') {
                streamPort = addr.port;
                console.log(`[ATM Music] Music Proxy running on port ${streamPort}`);
                resolve(streamPort);
            } else {
                resolve(0);
            }
        });
    });
}

export async function handleWebviewMessage(
    webviewView: vscode.WebviewView,
    message: WebviewMessage,
) {
    if (message.type === 'ready') {
        const port = await startAudioServer();
        const apiKey = vscode.workspace.getConfiguration('atm').get<string>('youtubeApiKey') || '';
        webviewView.webview.postMessage({
            type: 'config',
            streamPort: port,
            apiKey
        } as WebviewMessage);
    } else if (message.type === 'search' && message.query) {
        handleSearch(webviewView, message.query);
    } else if (message.type === 'validateAndSaveApi' && message.apiKey) {
        handleValidateApiKey(webviewView, message.apiKey);
    } else if (message.type === 'openUrl' && message.url) {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
    } else if (message.type === 'clearApiKey') {
        await vscode.workspace.getConfiguration('atm').update('youtubeApiKey', '', vscode.ConfigurationTarget.Global);
        webviewView.webview.postMessage({ type: 'apiKeyValidationResult', isValid: false, apiKey: '' } as WebviewMessage);
    }
}

/**
 * Closes the audio proxy server. Call this from extension deactivate().
 */
export function stopAudioServer(): void {
    if (streamServer) {
        streamServer.close(() => {
            console.log('[ATM Music] Audio proxy server stopped.');
        });
        streamServer = null;
        streamPort = 0;
    }
}

async function handleSearch(webviewView: vscode.WebviewView, query: string) {
    try {
        const results = await providerManager.searchAll(query);
        webviewView.webview.postMessage({ 
            type: 'searchResults', 
            results 
        } as WebviewMessage);
    } catch (error) {
        console.error('[ATM Music] Search error:', error);
        webviewView.webview.postMessage({
            type: 'error',
            message: 'Failed to search. Check your connection.',
        } as WebviewMessage);
    }
}

async function handleValidateApiKey(webviewView: vscode.WebviewView, apiKey: string) {
    try {
        const key = (apiKey || '').trim();
        if (!key) {
            webviewView.webview.postMessage({ type: 'apiKeyValidationResult', isValid: false } as WebviewMessage);
            return;
        }

        const validation = await validateYoutubeApiKey(key);

        if (validation.isValid) {
            await vscode.workspace.getConfiguration('atm').update('youtubeApiKey', key, vscode.ConfigurationTarget.Global);
            webviewView.webview.postMessage({ type: 'apiKeyValidationResult', isValid: true, apiKey: key } as WebviewMessage);
            vscode.window.showInformationMessage('✅ YouTube API Key saved successfully!');
        } else {
            webviewView.webview.postMessage({
                type: 'apiKeyValidationResult',
                isValid: false,
                message: validation.message || 'Invalid YouTube API key or unavailable key.'
            } as WebviewMessage);
        }
    } catch (e) {
        webviewView.webview.postMessage({ type: 'apiKeyValidationResult', isValid: false } as WebviewMessage);
    }
}

async function validateYoutubeApiKey(apiKey: string): Promise<{ isValid: boolean; message?: string }> {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${encodeURIComponent(apiKey)}`;

    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            let raw = '';

            res.on('data', (chunk) => {
                raw += chunk.toString();
            });

            res.on('end', () => {
                const status = res.statusCode || 0;
                let parsed: any = null;

                if (raw) {
                    try {
                        parsed = JSON.parse(raw);
                    } catch {
                        parsed = null;
                    }
                }

                if (status === 200 && !parsed?.error) {
                    resolve({ isValid: true });
                    return;
                }

                const backendMessage = typeof parsed?.error?.message === 'string' ? parsed.error.message : '';
                const fallbackMessage = status === 403
                    ? 'API key rejected (permissions or quota).'
                    : status === 400
                        ? 'API key format is invalid.'
                        : status > 0
                            ? `API validation failed (${status}).`
                            : 'API validation failed.';

                resolve({ isValid: false, message: backendMessage || fallbackMessage });
            });
        });

        req.setTimeout(8000, () => {
            req.destroy(new Error('timeout'));
        });

        req.on('error', () => {
            resolve({ isValid: false, message: 'Network error while validating API key.' });
        });
    });
}

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { WebviewMessage } from '../types';
import { getProviderManager } from '../../music/providers/provider-manager';

let streamServer: http.Server | null = null;
let streamPort = 0;

const PODCAST_DISCOVERY_ENDPOINTS = [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
];

const PODCAST_FALLBACK = {
    label: 'Podcast',
    streamUrl: 'https://securestreams2.autopo.st:1185/;stream/1',
};

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
                const realUrl = await getProviderManager().getStreamUrl(provider, videoId);

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

                    // Cleanup: destroy upstream if client disconnects mid-stream
                    res.on('close', () => {
                        streamRes.destroy();
                    });
                }).on('error', (e) => {
                    console.error('[ATM Music] Pipe error:', e);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end();
                    }
                });

            } else if (url.pathname === '/radio') {
                const streamUrl = (url.searchParams.get('streamUrl') || '').trim();
                if (!streamUrl) {
                    res.writeHead(400);
                    return res.end('Missing streamUrl');
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

                let parsed: URL;
                try {
                    parsed = new URL(streamUrl);
                } catch {
                    res.writeHead(400);
                    return res.end('Invalid streamUrl');
                }

                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    res.writeHead(400);
                    return res.end('Unsupported streamUrl protocol');
                }

                const hostname = parsed.hostname;
                if (
                    hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname === '0.0.0.0' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.') || 
                    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
                ) {
                    res.writeHead(403);
                    return res.end('Forbidden target IP');
                }

                proxyRadioStream(parsed.toString(), req, res, 0);

            } else if (url.pathname === '/discover/podcast') {
                // Restrict CORS to VS Code webview origins only
                const origin = req.headers.origin || '';
                const allowedOrigin = origin.startsWith('vscode-webview://') ? origin : 'null';
                res.setHeader('Access-Control-Allow-Origin', allowedOrigin);

                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.writeHead(204);
                    return res.end();
                }

                const station = await discoverPodcastStation();
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store',
                });
                return res.end(JSON.stringify(station));

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

    // Prevent hanging connections from leaking file descriptors
    streamServer.timeout = 30000;        // 30s max for non-streaming requests
    streamServer.keepAliveTimeout = 5000; // 5s keepalive between requests

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
        webviewView.webview.postMessage({
            type: 'config',
            streamPort: port
        } as WebviewMessage);
    } else if (message.type === 'search' && message.query) {
        handleSearch(webviewView, message.query, message.searchId);
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

async function handleSearch(webviewView: vscode.WebviewView, query: string, searchId?: number) {
    try {
        const results = await getProviderManager().searchAll(query);
        webviewView.webview.postMessage({ 
            type: 'searchResults', 
            results,
            searchId
        } as WebviewMessage);
    } catch (error) {
        console.error('[ATM Music] Search error:', error);
        webviewView.webview.postMessage({
            type: 'error',
            message: 'Failed to search. Check your connection.',
        } as WebviewMessage);
    }
}

function proxyRadioStream(
    targetUrl: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    redirectDepth: number,
): void {
    if (redirectDepth > 5) {
        if (!res.headersSent) {
            res.writeHead(508);
        }
        res.end('Too many redirects');
        return;
    }

    let parsed: URL;
    try {
        parsed = new URL(targetUrl);
    } catch {
        if (!res.headersSent) {
            res.writeHead(400);
        }
        res.end('Invalid redirected stream URL');
        return;
    }

    const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Connection': 'keep-alive',
    };

    const protocol = parsed.protocol === 'https:' ? https : http;
    protocol.get(parsed.toString(), { headers: upstreamHeaders }, (streamRes) => {
        if (streamRes.statusCode && streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
            const nextUrl = new URL(streamRes.headers.location, parsed).toString();
            streamRes.resume();
            return proxyRadioStream(nextUrl, req, res, redirectDepth + 1);
        }

        // Radio is treated as a live stream. Avoid range/length headers to
        // prevent short segmented responses from being interpreted as finite tracks.
        const outHeaders: Record<string, string | string[]> = {
            'Content-Type': streamRes.headers['content-type'] || 'audio/mpeg',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache',
            'Connection': 'keep-alive',
        };

        if (streamRes.headers['icy-br']) {
            outHeaders['icy-br'] = streamRes.headers['icy-br'];
        }
        if (streamRes.headers['ice-audio-info']) {
            outHeaders['ice-audio-info'] = streamRes.headers['ice-audio-info'];
        }

        res.writeHead(streamRes.statusCode || 200, outHeaders);
        streamRes.pipe(res);

        // Cleanup: destroy upstream if client disconnects mid-stream
        res.on('close', () => {
            streamRes.destroy();
        });
    }).on('error', (e) => {
        console.error('[ATM Music] Radio pipe error:', e);
        if (!res.headersSent) {
            res.writeHead(500);
        }
        res.end();
    });
}

type RadioBrowserStation = {
    name?: string;
    url?: string;
    url_resolved?: string;
    codec?: string;
    hls?: number | string;
    lastcheckok?: number | string;
};

async function discoverPodcastStation(): Promise<{ label: string; streamUrl: string }> {
    for (const endpoint of PODCAST_DISCOVERY_ENDPOINTS) {
        try {
            const stations = await fetchRadioBrowserPodcastStations(endpoint);
            const station = pickBestPodcastStation(stations);
            if (station) {
                return station;
            }
        } catch (error) {
            console.warn(`[ATM Music] Podcast discovery failed on ${endpoint}:`, error);
        }
    }

    return PODCAST_FALLBACK;
}

function fetchRadioBrowserPodcastStations(endpoint: string): Promise<RadioBrowserStation[]> {
    return new Promise((resolve, reject) => {
        const apiUrl = `${endpoint}/json/stations/search?tag=podcast&hidebroken=true&order=clickcount&reverse=true&limit=35`;

        const apiRequest = https.get(apiUrl, {
            headers: {
                'User-Agent': 'ATM Focus Extension/1.0',
                'Accept': 'application/json',
            },
            timeout: 10000,
        }, (response) => {
            if ((response.statusCode || 500) >= 400) {
                response.resume();
                return reject(new Error(`Podcast API returned ${response.statusCode}`));
            }

            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (Array.isArray(parsed)) {
                        resolve(parsed as RadioBrowserStation[]);
                    } else {
                        resolve([]);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        apiRequest.on('timeout', () => {
            apiRequest.destroy(new Error('Podcast API timeout'));
        }).on('error', (error) => {
            reject(error);
        });
    });
}

function pickBestPodcastStation(stations: RadioBrowserStation[]): { label: string; streamUrl: string } | null {
    for (const station of stations) {
        const streamUrl = (station.url_resolved || station.url || '').trim();
        if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
            continue;
        }

        const isOk = Number(station.lastcheckok ?? 1) === 1;
        if (!isOk) {
            continue;
        }

        const isHls = Number(station.hls ?? 0) === 1;
        if (isHls) {
            continue;
        }

        const codec = (station.codec || '').toLowerCase();
        const likelyPlayable = !codec || codec.includes('mp3') || codec.includes('aac');
        if (!likelyPlayable) {
            continue;
        }

        const rawLabel = (station.name || PODCAST_FALLBACK.label).trim();
        return {
            label: rawLabel || PODCAST_FALLBACK.label,
            streamUrl,
        };
    }

    return null;
}

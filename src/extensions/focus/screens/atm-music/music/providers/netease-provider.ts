import { Track } from '../../shared/types';
import { IMusicProvider } from './base-provider';

interface NeteaseApiClient {
    cloudsearch(params: { keywords: string; type: number; limit: number; offset: number }): Promise<{ body: unknown }>;
    song_url(params: { id: string; br: number }): Promise<{ body: unknown }>;
}

// Lazy-load NeteaseCloudMusicApi to prevent crashing the entire extension
// when the module is not available (e.g. packaged VSIX without node_modules).
let neteaseApi: NeteaseApiClient | null = null;
let neteaseLoadAttempted = false;

function getNeteaseApi(): NeteaseApiClient | null {
    if (!neteaseLoadAttempted) {
        neteaseLoadAttempted = true;
        try {
            neteaseApi = require('NeteaseCloudMusicApi') as NeteaseApiClient;
        } catch {
            neteaseApi = null;
        }
    }
    return neteaseApi;
}

interface NeteaseSong {
    id: number;
    name: string;
    ar?: { name: string }[];
    al?: { name: string; picUrl: string };
    dt?: number;
}

interface NeteaseCloudSearchResponse {
    code: number;
    result?: {
        songs?: NeteaseSong[];
    };
}

interface NeteaseSongUrlResponse {
    code: number;
    data: {
        id: number;
        url: string;
    }[];
}

export class NeteaseProvider implements IMusicProvider {
    readonly name = 'netease';

    isAvailable(): boolean {
        return getNeteaseApi() !== null;
    }

    async search(query: string, limit = 30): Promise<Track[]> {
        const api = getNeteaseApi();
        if (!api) { return []; }

        try {
            const result = await api.cloudsearch({
                keywords: query,
                type: 1,
                limit,
                offset: 0
            });

            const data = result.body as unknown as NeteaseCloudSearchResponse;
            if (data.code !== 200 || !data.result?.songs) {
                return [];
            }

            const songs: NeteaseSong[] = data.result.songs;
            const ids = songs.map(s => String(s.id)).join(',');

            const urlResult = await api.song_url({ id: ids, br: 320000 });
            const urls = (urlResult.body as unknown as NeteaseSongUrlResponse).data;

            const urlMap = new Map<number, string>();
            urls.forEach(u => {
                if (u.url) {
                    urlMap.set(u.id, u.url.replace(/^http:\/\//i, 'https://'));
                }
            });

            const validTracks: Track[] = [];
            songs.forEach((song) => {
                const streamUrl = urlMap.get(song.id);
                if (!streamUrl) {return;}

                let picUrl = song.al?.picUrl ? song.al.picUrl.replace(/^http:\/\//i, 'https://') : '';
                if (picUrl) {picUrl += '?param=300y300';}

                validTracks.push({
                    id: `netease_${song.id}`,
                    videoId: String(song.id),
                    title: song.name,
                    artist: song.ar?.map(a => a.name).join(', ') || 'Unknown Artist',
                    album: song.al?.name || '',
                    thumbnail: picUrl,
                    duration: song.dt ? Math.floor(song.dt / 1000) : 0,
                    preview: streamUrl,
                    provider: 'netease',
                    canPlay: true,
                    isFullTrack: true,
                    region: 'chinese',
                    quality: '320k',
                });
            });

            return validTracks;
        } catch {

            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string | null> {
        const api = getNeteaseApi();
        if (!api) { return null; }

        try {
            const urlResult = await api.song_url({ id: trackId, br: 320000 });
            const urls = (urlResult.body as unknown as NeteaseSongUrlResponse).data;
            const url = urls?.[0]?.url;
            return url ? url.replace(/^http:\/\//i, 'https://') : null;
        } catch {
            return null;
        }
    }
}


import { WebviewMessage, Track } from '../../shared/types';
import { MusicSearchUI } from './search';
import { MusicResultsUI } from './results';
import { MusicPlayerUI } from '../../shared/player/player';
import { $, escapeHtml } from '../../../../shared/utils';
import { getRandomPeruAmStation } from '../../radio/providers/am';

export interface VSCodeApi {
    postMessage: (message: WebviewMessage) => void;
}

export class AtmMusicController {
    private searchUI: MusicSearchUI;
    private resultsUI: MusicResultsUI;
    private playerUI: MusicPlayerUI;
    
    private tracks: Track[] = [];
    private currentIndex = -1;
    private hasCachedSearch = false;
    private musicLabelEl: HTMLElement | null = null;
    private radioReconnectTimer: number | null = null;
    private radioRetryDecayTimer: number | null = null;
    private radioRetryCount = 0;
    private readonly radioRetryBaseDelayMs = 1000;
    private readonly radioRetryMaxDelayMs = 15000;
    private readonly radioRetryResetWindowMs = 20000;
    private readonly radioRetryMaxAttempts = 8;
    private currentRadioStationKey: string | null = null;
    private lastAmStationId: string | null = null;
    private cachedPodcastStation: { title: string; streamUrl: string } | null = null;
    private podcastDiscoveryInFlight: Promise<void> | null = null;
    private currentSearchId = 0;

    constructor(private readonly vscode: VSCodeApi) {
        this.musicLabelEl = $('#qa-music-label');
        this.mountBaseHtml();
        
        this.searchUI = new MusicSearchUI(
            (q) => this.performSearch(q),
            () => this.showScreen('results')
        );

        this.resultsUI = new MusicResultsUI(
            (i) => this.selectTrack(i),
            (q) => this.performSearch(q),
            () => this.backToSearch(),
            () => this.showScreen('player')
        );

        this.playerUI = new MusicPlayerUI(
            () => this.playNext(),
            () => this.playPrev(),
            () => this.handleBackFromPlayer(),
            () => this.handlePlaybackFallback(),
            () => this.playRandomAmStation()
        );

        this.bindGlobalMessages();
        this.updateMusicLabelState();
    }

    private mountBaseHtml() {
        const root = $('#atm-music-root');
        if (!root) {return;}
        root.innerHTML = `
            <section id="screen-results" class="screen">
                <div class="screen-header">
                    <button id="back-to-search" class="back-btn" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>Search</button>
                    <div class="results-query">
                        <input type="search" id="results-query-input" class="results-query-input" placeholder="Edit search..." autocomplete="off">
                        <button id="results-query-btn" class="results-query-btn" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>
                    </div>
                </div>
                <div id="results-container" class="results-container"></div>
            </section>
            <section id="screen-player" class="screen">
                <div class="screen-header">
                    <button id="back-to-results" class="back-btn" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>Back</button>
                    <span id="player-track-info" class="player-track-info"></span>
                    <button id="player-random-country-btn" class="header-icon-btn" type="button" title="Random AM country" aria-label="Play random AM country" aria-hidden="true" hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9"></circle>
                            <path d="M3 12h18"></path>
                            <path d="M12 3a14 14 0 0 1 0 18"></path>
                            <path d="M12 3a14 14 0 0 0 0 18"></path>
                        </svg>
                    </button>
                </div>
                <div id="player-container" class="player-container"></div>
            </section>
            <div id="music-error-container"></div>
        `;
    }

    private bindGlobalMessages() {
        window.addEventListener('message', (event: MessageEvent) => {
            const msg = event.data as WebviewMessage;
            if (msg.type === 'config' && msg.streamPort) {
                window.STREAM_PORT = msg.streamPort;
            } else if (msg.type === 'searchResults') {
                if (msg.searchId !== undefined && msg.searchId !== this.currentSearchId) {
                    return; // Ignore stale search result
                }
                this.tracks = msg.results || [];
                this.hasCachedSearch = true;
                this.resultsUI.render(this.tracks);
                this.searchUI.setCanForward(true);
                this.updateMusicLabelState();
            } else if (msg.type === 'error') {
                this.showError(msg.message || 'Unknown error');
            } else if (msg.type === 'togglePlayPause') {
                this.playerUI.togglePlaybackIfNeeded();
            }
        });

        // Notify Extension to start the background audio stream server
        this.vscode.postMessage({ type: 'ready' } as WebviewMessage);
    }

    private performSearch(query: string) {
        this.tracks = [];
        this.hasCachedSearch = false;
        this.currentRadioStationKey = null;
        this.clearError();
        this.searchUI.setCanForward(false);
        this.resultsUI.setQuery(query);
        this.resultsUI.showSkeleton();
        this.showScreen('results');
        this.updateMusicLabelState();
        this.currentSearchId++;
        this.vscode.postMessage({ type: 'search', query, searchId: this.currentSearchId });
    }

    private selectTrack(index: number) {
        this.currentIndex = index;
        const track = this.tracks[index];
        if (track) {
            if (!this.isRadioTrack(track)) {
                this.currentRadioStationKey = null;
            }
            this.showScreen('player');
            this.playerUI.playTrack(track, index > 0, index < this.tracks.length - 1);
            this.updateMusicLabelState();
        }
    }

    private playNext(silent = false) {
        const currentTrack = this.currentIndex > -1 ? this.tracks[this.currentIndex] : null;

        // Live radio mode: reconnect same stream if it naturally ends and we are at the newest station.
        if (currentTrack && this.isRadioTrack(currentTrack) && this.currentIndex === this.tracks.length - 1) {
            this.retryRadioStream(currentTrack);
            return;
        }

        if (this.currentIndex < this.tracks.length - 1) {
            this.currentIndex++;
            const track = this.tracks[this.currentIndex];
            if (track) {
                if (silent) {
                    // Silent skip: don't re-render the player, just update header and try to play
                    this.playerUI.skipToTrack(
                        track,
                        this.currentIndex > 0,
                        this.currentIndex < this.tracks.length - 1
                    );
                } else {
                    this.selectTrack(this.currentIndex);
                }
            }
        }
    }

    private playPrev() {
        if (this.currentIndex > 0) {this.selectTrack(this.currentIndex - 1);}
    }

    private backToSearch() {
        // Keep current playback alive while browsing back to Search.
        this.showScreen('search');
        this.searchUI.setCanForward(this.hasCachedSearch);
    }

    private handleBackFromPlayer() {
        const currentTrack = this.currentIndex > -1 ? this.tracks[this.currentIndex] : null;
        if (currentTrack && this.isRadioTrack(currentTrack)) {
            // In radio mode, Back should return to station selection, not music results.
            this.showScreen('search');
            this.searchUI.setCanForward(false);
            return;
        }

        this.showScreen('results');
    }

    private showScreen(name: 'search' | 'results' | 'player') {
        // Only manage music-related screens - don't touch time/game
        const musicScreenIds = ['screen-search', 'screen-results', 'screen-player'];
        musicScreenIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.toggle('active', id === `screen-${name}`);
            }
        });

        // Tell results list if there's an active track we can return to
        if (name === 'results') {
            this.resultsUI.setCanForward(this.currentIndex > -1);
        }
    }

    private handlePlaybackFallback() {
        const currentTrack = this.currentIndex > -1 ? this.tracks[this.currentIndex] : null;

        if (currentTrack && this.isRadioTrack(currentTrack)) {
            this.retryRadioStream(currentTrack);
            return;
        }

        // Silent skip: try the next track without re-rendering
        if (this.currentIndex < this.tracks.length - 1) {
            this.playNext(true);  // silent = true
        } else {
            this.showError('No playable tracks found.');
        }
    }

    private showError(message: string) {
        const container = $('#music-error-container');
        if (container) {
            container.innerHTML = `<div class="error-msg">${escapeHtml(message)}</div>`;
            setTimeout(() => this.clearError(), 5000);
        }
    }

    private clearError() {
        const container = $('#music-error-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    // Public API for external integration
    public search(query: string) { this.searchUI.setQuery(query); this.performSearch(query); }

    public playPodcastFromApi(fallbackTitle: string, fallbackStreamUrl: string, stationKey = 'podcast'): void {
        const fallbackSafeTitle = (fallbackTitle || 'Podcast').trim();
        const fallbackSafeStreamUrl = (fallbackStreamUrl || '').trim();

        // Play immediately (same UX as FM/LoFi), using cached API result or fallback.
        const stationToPlay = this.cachedPodcastStation ?? {
            title: fallbackSafeTitle,
            streamUrl: fallbackSafeStreamUrl,
        };
        this.playRadioStream(stationToPlay.title, stationToPlay.streamUrl, stationKey);

        this.ensurePodcastDiscovery(fallbackSafeTitle, fallbackSafeStreamUrl);
    }

    private ensurePodcastDiscovery(fallbackTitle: string, fallbackStreamUrl: string): void {
        if (this.podcastDiscoveryInFlight) {
            return;
        }

        const port = window.STREAM_PORT || 0;
        if (port <= 0) {
            return;
        }

        this.podcastDiscoveryInFlight = (async () => {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/discover/podcast`);
                if (!response.ok) {
                    throw new Error(`Podcast discovery failed with HTTP ${response.status}`);
                }

                const data = await response.json() as { label?: string; streamUrl?: string };
                const title = (data.label || fallbackTitle).trim();
                const streamUrl = (data.streamUrl || fallbackStreamUrl).trim();

                if (streamUrl) {
                    this.cachedPodcastStation = {
                        title: title || fallbackTitle,
                        streamUrl,
                    };
                }
            } catch (error) {
                console.warn('[ATM Music] Podcast API discovery failed; fallback remains active:', error);
            } finally {
                this.podcastDiscoveryInFlight = null;
            }
        })();
    }

    public playRadioStream(stationTitle: string, streamUrl: string, stationKey?: string) {
        const rawTitle = (stationTitle || 'Radio').trim();
        const hasBandPrefix = /^(fm|am)\s*-\s*/i.test(rawTitle) || rawTitle.toLowerCase() === 'am';
        const safeTitle = hasBandPrefix ? rawTitle : `FM - ${rawTitle}`;
        const safeStreamUrl = (streamUrl || '').trim();
        if (!safeStreamUrl) {
            this.showError('Radio stream is unavailable.');
            return;
        }

        const port = window.STREAM_PORT || 0;
        const proxiedUrl = port > 0
            ? `http://127.0.0.1:${port}/radio?streamUrl=${encodeURIComponent(safeStreamUrl)}`
            : safeStreamUrl;

        const radioTrack: Track = {
            id: `radio_${safeTitle.toLowerCase().replace(/\s+/g, '_')}`,
            videoId: '',
            title: safeTitle,
            artist: 'Radio',
            album: 'Live Stream',
            thumbnail: '',
            duration: 0,
            preview: proxiedUrl,
            provider: 'deezer',
            canPlay: true,
            isFullTrack: true,
        };

        // Save previous group before updating
        const prevGroup = this.currentRadioStationKey ? this.currentRadioStationKey.split(':')[0] : null;

        this.clearError();
        this.clearRadioReconnectTimer();
        this.resetRadioRetryState();
        this.currentRadioStationKey = stationKey || null;
        if (this.currentRadioStationKey?.startsWith('am-peru:')) {
            const [, stationId] = this.currentRadioStationKey.split(':');
            this.lastAmStationId = stationId || null;
        }

        // Clear history when switching between different radio groups (e.g. FM → AM)
        const newGroup = stationKey ? stationKey.split(':')[0] : null;
        const isSameGroup = prevGroup !== null && newGroup !== null && prevGroup === newGroup;

        if (this.tracks.length === 0 || !this.isRadioTrack(this.tracks[0]) || !isSameGroup) {
            this.tracks = [radioTrack];
            this.currentIndex = 0;
        } else {
            // Cut future history if moving to a new station from the past
            this.tracks = this.tracks.slice(0, this.currentIndex + 1);
            
            const currentHistoryTrack = this.tracks[this.currentIndex];
            if (!currentHistoryTrack || currentHistoryTrack.id !== radioTrack.id) {
                this.tracks.push(radioTrack);
                this.currentIndex++;
            }
        }
        this.hasCachedSearch = false;
        
        this.showScreen('player');
        this.playerUI.playTrack(radioTrack, this.currentIndex > 0, this.currentIndex < this.tracks.length - 1);
        this.updateMusicLabelState();

        // Notify global listeners about the station change (useful for UI flag updates)
        window.dispatchEvent(new CustomEvent('atm_station_changed', { 
            detail: { 
                title: safeTitle, 
                stationKey: this.currentRadioStationKey 
            } 
        }));
    }

    public playRandomAmStation(): void {
        const nextAmStation = getRandomPeruAmStation(this.lastAmStationId);
        this.lastAmStationId = nextAmStation.id;
        this.playRadioStream(nextAmStation.label, nextAmStation.streamUrl, `am-peru:${nextAmStation.id}`);
    }

    /** True if this station is the currently loaded one, regardless of play/pause state. */
    public isCurrentRadioStation(stationKey: string): boolean {
        if (!stationKey || !this.currentRadioStationKey) { return false; }
        const currentTrack = this.currentIndex > -1 ? this.tracks[this.currentIndex] : null;
        if (!currentTrack || !this.isRadioTrack(currentTrack)) { return false; }
        return this.currentRadioStationKey.startsWith(stationKey);
    }

    /** True only when this station is loaded AND audio is actively playing. */
    public isPlayingRadioStation(stationKey: string): boolean {
        if (!stationKey) {
            return false;
        }

        const currentTrack = this.currentIndex > -1 ? this.tracks[this.currentIndex] : null;
        if (!currentTrack || !this.isRadioTrack(currentTrack)) {
            return false;
        }

        return this.playerUI.isRunning() && !!this.currentRadioStationKey && this.currentRadioStationKey.startsWith(stationKey);
    }

    private isRadioTrack(track: Track): boolean {
        return track.id.startsWith('radio_');
    }

    private retryRadioStream(track: Track): void {
        this.clearRadioReconnectTimer();
        this.clearRadioRetryDecayTimer();

        if (this.radioRetryCount >= this.radioRetryMaxAttempts) {
            this.showError('Radio stream unstable. Tap the station to retry.');
            return;
        }

        this.radioRetryCount += 1;
        const delay = Math.min(
            this.radioRetryBaseDelayMs * Math.pow(2, this.radioRetryCount - 1),
            this.radioRetryMaxDelayMs,
        );

        this.radioReconnectTimer = window.setTimeout(() => {
            this.clearError();
            this.playerUI.skipToTrack(track, false, false);
        }, delay);

        // If stream stays up for a while, allow fast retries again.
        this.radioRetryDecayTimer = window.setTimeout(() => {
            this.radioRetryCount = 0;
            this.radioRetryDecayTimer = null;
        }, this.radioRetryResetWindowMs);
    }

    private clearRadioReconnectTimer(): void {
        if (this.radioReconnectTimer !== null) {
            window.clearTimeout(this.radioReconnectTimer);
            this.radioReconnectTimer = null;
        }
    }

    private clearRadioRetryDecayTimer(): void {
        if (this.radioRetryDecayTimer !== null) {
            window.clearTimeout(this.radioRetryDecayTimer);
            this.radioRetryDecayTimer = null;
        }
    }

    private resetRadioRetryState(): void {
        this.radioRetryCount = 0;
        this.clearRadioRetryDecayTimer();
    }

    /** Navigate to player (if a track is loaded) or results (if a search was made). */
    public goToMusic() {
        if (this.currentIndex > -1) {
            this.showScreen('player');
        } else if (this.hasCachedSearch) {
            this.showScreen('results');
        }
        // else: already on search screen, nothing to do
    }

    private updateMusicLabelState() {
        if (!this.musicLabelEl) {return;}
        const canGo = (this.currentIndex > -1 || this.hasCachedSearch);
        this.musicLabelEl.classList.toggle('is-linkable', canGo);
    }

    public getCurrentTrack(): Track | null {
        if (this.currentIndex > -1 && this.currentIndex < this.tracks.length) {
            return this.tracks[this.currentIndex];
        }
        return null;
    }
}

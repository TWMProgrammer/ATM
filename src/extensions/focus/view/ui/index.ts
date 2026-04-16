declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };

import { createAtmMusicController } from '../../screens/atm-music/root';
import { LOFI_2026_STREAM_URL } from '../../screens/atm-music/radio/providers/lofi';
import { FM_111_STREAM_URL } from '../../screens/atm-music/radio/providers/normal';
import { PODCAST_STREAM_URL } from '../../screens/atm-music/radio/providers/podcast';
import { createAtmTimeController } from '../../screens/atm-time/ui/index';
import { initDataUI, getNicknameController } from '../../screens/atm-data/data';

(function () {
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;

    // Mount Data screen
    const atmGameRoot = document.querySelector('#atm-data-root') as HTMLElement | null;

    let isScreenshotOpen = false;

    if (atmGameRoot) {
        // Initialize data carousel + nickname (all encapsulated)
        initDataUI();

        // Share Data logic
        const shareBtn = document.querySelector('#atom-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const nickname = getNicknameController()?.getNickname() || '@Player';
                const currentTrack = musicController.getCurrentTrack();
                const song = currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : null;
                const pomodoros = timeController?.getCompletedPomodoros ? timeController.getCompletedPomodoros() : 0;
                
                const payloadContent = {
                    nickname: nickname,
                    song: song,
                    pomodoros: pomodoros
                };

                if (isScreenshotOpen) {
                    // Trigger a specific dynamic refresh
                    vscode.postMessage({
                        type: 'refresh_screenshot',
                        payload: payloadContent
                    });
                } else {
                    // Open the panel for the first time
                    vscode.postMessage({
                        type: 'open_screenshot',
                        payload: payloadContent
                    });
                }
            });
        }
    }

    // Handle messages from the extension host
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.type === 'playRandomAM') {
            musicController.playRandomAmStation();
            return;
        }

        if (message.type === 'screenshot_state_changed') {
            isScreenshotOpen = message.isOpen;
            const shareBtn = document.querySelector('#atom-share-btn');
            if (shareBtn) {
                if (message.isOpen) {
                    shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path></svg>`;
                    shareBtn.setAttribute('title', 'Refresh Data');
                } else {
                    shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v4c-6.575 1.028 -9.02 6.788 -10 12c-.037 .206 5.384 -5.962 10 -6v4l8 -7l-8 -7"></path></svg>`;
                    shareBtn.setAttribute('title', 'Share Data');
                }
            }

            return;
        }

        if (message.type === 'atm_music_favorites_state') {
            const payload = message as FavoriteMessagePayload;
            favorites = normalizeFavoritesPayload(payload.favorites);
            const firstEmpty = favorites.indexOf(null);
            nextReplacementSlot = firstEmpty > -1 ? firstEmpty : 0;
            updateFavoritesUI();
            syncRadioButtonStates();
            setFavoritesHydrated(true);
        }
    });

    // Initialize Music Controller (handles search, results, player internally)
    const musicController = createAtmMusicController(vscode);

    // Initialize Time Controller (Pomodoro)
    const timeController = createAtmTimeController();

    // Quick Access buttons (Music / Time / Game)
    const quickAccessButtons = Array.from(document.querySelectorAll('.qa-btn')) as HTMLButtonElement[];
    const musicQuickButton = document.querySelector('#qa-music-tab') as HTMLButtonElement | null;
    const musicLabel = document.querySelector('#qa-music-label') as HTMLElement | null;
    const musicSearchPanel = document.querySelector('#mode-panel-music-search') as HTMLElement | null;
    const radioPanel = document.querySelector('#mode-panel-radio') as HTMLElement | null;
    const radioButtons = Array.from(document.querySelectorAll('.radio-mode-btn')) as HTMLButtonElement[];
    const primaryRadioButtons = radioButtons.slice(0, 3);

    type AudioUiMode = 'music' | 'radio';
    let audioUiMode: AudioUiMode = 'radio';

    const setAudioUiMode = (mode: AudioUiMode) => {
        audioUiMode = mode;

        if (musicLabel) {
            musicLabel.textContent = mode === 'music' ? 'Music' : 'Radio';
        }

        if (mode === 'music') {
            musicSearchPanel?.classList.add('is-active');
            musicSearchPanel?.setAttribute('aria-hidden', 'false');
            radioPanel?.classList.remove('is-active');
            radioPanel?.setAttribute('aria-hidden', 'true');
        } else {
            musicSearchPanel?.classList.remove('is-active');
            musicSearchPanel?.setAttribute('aria-hidden', 'true');
            radioPanel?.classList.add('is-active');
            radioPanel?.setAttribute('aria-hidden', 'false');

            // Sync is-active (selected) and is-playing (EQ) when returning to radio panel
            syncRadioButtonStates();
        }
    };

    const parseFavoriteIndex = (stationKey: string): number | null => {
        if (!stationKey.startsWith('fav-')) {
            return null;
        }
        const value = Number.parseInt(stationKey.slice(4), 10);
        return Number.isNaN(value) ? null : value;
    };

    const freezePrimaryRadioButtonWidths = () => {
        primaryRadioButtons.forEach((button) => {
            const width = Math.ceil(button.getBoundingClientRect().width);
            if (width <= 0) {
                return;
            }

            button.style.width = `${width}px`;
            button.style.minWidth = `${width}px`;
            button.style.maxWidth = `${width}px`;
        });
    };

    // Helper: re-sync is-active AND is-playing for all radio buttons
    const syncRadioButtonStates = () => {
        radioButtons.forEach((button) => {
            const station = button.dataset.radioStation || '';
            let isActive = false;
            let isPlaying = false;
            
            if (station.startsWith('fav-')) {
                const favIndex = parseFavoriteIndex(station);
                if (favIndex === null) {
                    button.classList.remove('is-active', 'is-playing');
                    return;
                }
                const fav = favorites[favIndex];
                if (fav) {
                    isActive = musicController.isCurrentRadioStation(fav.originalStationKey);
                    isPlaying = musicController.isPlayingRadioStation(fav.originalStationKey);
                }
            } else {
                isActive = musicController.isCurrentRadioStation(station);
                isPlaying = musicController.isPlayingRadioStation(station);
            }
            button.classList.toggle('is-active', isActive);
            button.classList.toggle('is-playing', isPlaying);
        });
    };

    const radioStationMap: Record<string, { title: string; streamUrl: string }> = {
        'fm-111': {
            title: 'FM - 111',
            streamUrl: FM_111_STREAM_URL,
        },
        'lofi-2026': {
            title: 'FM - LoFi 2026',
            streamUrl: LOFI_2026_STREAM_URL,
        },
        'podcast': {
            title: 'FM - Podcast',
            streamUrl: PODCAST_STREAM_URL,
        },
    };

    // Favorites System (3 slots)
    interface FavoriteStation {
        id: string;
        title: string;
        streamUrl: string;
        preview?: string;
        originalStationKey: string;
    }

    const FAVORITES_SLOT_COUNT = 3;

    interface FavoriteMessagePayload {
        favorites?: unknown;
    }

    const sanitizeFavoriteStation = (entry: unknown): FavoriteStation | null => {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        const raw = entry as Record<string, unknown>;
        const id = typeof raw.id === 'string' ? raw.id.trim() : '';
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';
        const streamUrl = typeof raw.streamUrl === 'string'
            ? raw.streamUrl.trim()
            : (typeof raw.preview === 'string' ? raw.preview.trim() : '');
        const originalStationKey = typeof raw.originalStationKey === 'string'
            ? raw.originalStationKey.trim()
            : '';

        if (!id || !streamUrl || !originalStationKey) {
            return null;
        }

        return {
            id,
            title: title || 'AM',
            streamUrl,
            preview: typeof raw.preview === 'string' ? raw.preview.trim() : undefined,
            originalStationKey,
        };
    };

    const normalizeFavoritesPayload = (value: unknown): (FavoriteStation | null)[] => {
        const source = Array.isArray(value) ? value : [];
        const normalized: (FavoriteStation | null)[] = [];
        const seenIds = new Set<string>();

        for (const entry of source) {
            if (normalized.length >= FAVORITES_SLOT_COUNT) {
                break;
            }

            const favorite = sanitizeFavoriteStation(entry);
            if (!favorite || seenIds.has(favorite.id)) {
                normalized.push(null);
                continue;
            }

            seenIds.add(favorite.id);
            normalized.push(favorite);
        }

        while (normalized.length < FAVORITES_SLOT_COUNT) {
            normalized.push(null);
        }

        return normalized;
    };

    let favorites: (FavoriteStation | null)[] = [null, null, null];
    let nextReplacementSlot = 0;
    let favoritesHydrated = false;
    const FAVORITES_HYDRATION_TIMEOUT_MS = 1200;

    const setFavoritesHydrated = (hydrated: boolean) => {
        favoritesHydrated = hydrated;
        radioPanel?.classList.toggle('is-hydrating-favorites', !hydrated);
    };

    const persistFavorites = () => {
        const serializableFavorites = favorites.map((favorite) => {
            if (!favorite) {
                return null;
            }

            return {
                id: favorite.id,
                title: favorite.title,
                streamUrl: favorite.streamUrl,
                originalStationKey: favorite.originalStationKey,
            };
        });

        vscode.postMessage({
            type: 'atm_music_favorites_save',
            favorites: serializableFavorites,
        });
    };

    const isAmStation = (stationKey: string | undefined, track: { id: string; title: string }) => {
        if (stationKey?.startsWith('am:') || stationKey?.startsWith('am-peru:')) {
            return true;
        }
        if (/^radio_am[:_-]/i.test(track.id || '')) {
            return true;
        }
        return /^AM\s*-\s*/i.test(track.title || '');
    };

    const updateFavoritesUI = () => {
        const remaining = favorites.filter(f => f === null).length;
        const currentTrack = musicController.getCurrentTrack();
        const isFavorited = currentTrack ? favorites.some(f => f?.id === currentTrack.id) : false;
        
        musicController.updateFavoriteState(isFavorited, remaining);

        // Update Radio Buttons on the main panel
        radioButtons.forEach((btn, index) => {
            if (index >= 3) { return; } // Only first 3 buttons are overridable
            
            const fav = favorites[index];
            const btnTextEl = btn.querySelector('.btn-text');
            if (!btnTextEl) { return; }

            if (fav) {
                btnTextEl.textContent = fav.title;
                btn.dataset.radioStation = `fav-${index}`;
            } else {
                // Restore defaults
                if (index === 0) { btnTextEl.textContent = 'FM - 111'; btn.dataset.radioStation = 'fm-111'; }
                else if (index === 1) { btnTextEl.textContent = 'FM - LoFi'; btn.dataset.radioStation = 'lofi-2026'; }
                else if (index === 2) { btnTextEl.textContent = 'FM - Podcast'; btn.dataset.radioStation = 'podcast'; }
            }
        });
    };

    window.addEventListener('atm_toggle_favorite', ((event: CustomEvent) => {
        const { track, stationKey } = event.detail;
        if (!track || !track.id.startsWith('radio_')) { return; }
        if (!isAmStation(stationKey, track)) { return; }

        const existingIndex = favorites.findIndex(f => f?.id === track.id);

        if (existingIndex > -1) {
            // Remove from favorites
            favorites[existingIndex] = null;

            if (favorites.every(f => f === null)) {
                nextReplacementSlot = 0;
            }
        } else {
            // Add to favorites: use first empty slot, otherwise rotate replacement.
            const emptyIndex = favorites.indexOf(null);
            const targetIndex = emptyIndex > -1 ? emptyIndex : nextReplacementSlot;

            if (emptyIndex === -1) {
                nextReplacementSlot = (nextReplacementSlot + 1) % favorites.length;
            }

            let favTitle = track.title;
            const flagMatch = favTitle.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
            if (flagMatch) {
                favTitle = `AM - ${flagMatch[0]}`;
            } else {
                const parts = favTitle.split(' - ');
                favTitle = parts.length > 1 ? `AM - ${parts[parts.length - 1].substring(0, 5)}` : 'AM';
            }

            favorites[targetIndex] = {
                id: track.id,
                title: favTitle,
                streamUrl: (track.externalUrl || track.preview || '').trim(),
                originalStationKey: stationKey || track.id
            };
        }

        persistFavorites();
        updateFavoritesUI();
        syncRadioButtonStates();
    }) as EventListener);

    // Initial sync
    requestAnimationFrame(() => {
        freezePrimaryRadioButtonWidths();
    });

    setFavoritesHydrated(false);
    vscode.postMessage({ type: 'atm_music_favorites_load' });
    window.setTimeout(() => {
        if (!favoritesHydrated) {
            updateFavoritesUI();
            syncRadioButtonStates();
            setFavoritesHydrated(true);
        }
    }, FAVORITES_HYDRATION_TIMEOUT_MS);

    radioButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const station = button.dataset.radioStation || '';

            // Optimization: avoid reloading when the same one is already playing.
            if (musicController.isPlayingRadioStation(station)) {
                musicController.goToMusic();
                return;
            }

            // Check if it's a favorite button
            if (station.startsWith('fav-')) {
                const favIndex = parseFavoriteIndex(station);
                if (favIndex === null) {
                    return;
                }
                const fav = favorites[favIndex];
                if (fav) {
                    if (musicController.isPlayingRadioStation(fav.originalStationKey)) {
                        musicController.goToMusic();
                        return;
                    }
                    const favoriteStreamUrl = (fav.streamUrl || fav.preview || '').trim();
                    if (!favoriteStreamUrl) {
                        return;
                    }
                    musicController.playRadioStream(fav.title, favoriteStreamUrl, fav.originalStationKey);
                    return;
                }
            }

            if (station === 'am') {
                musicController.playRandomAmStation();
                return;
            }

            if (station === 'podcast') {
                musicController.playPodcastFromApi('FM - Podcast', PODCAST_STREAM_URL, 'podcast');
                return;
            }

            const selectedStation = radioStationMap[station];
            if (selectedStation) {
                musicController.playRadioStream(selectedStation.title, selectedStation.streamUrl, station);
            }
        });
    });

    // Listen for station changes: update heart icon state
    window.addEventListener('atm_station_changed', ((event: CustomEvent) => {
        const { title, stationKey } = event.detail;

        // Mark the matching button as selected (but not playing yet — audio may still be loading)
        radioButtons.forEach((button) => {
            const station = button.dataset.radioStation || '';
            let isActive = false;
            
            if (station.startsWith('fav-')) {
                const favIndex = parseFavoriteIndex(station);
                if (favIndex === null) {
                    button.classList.remove('is-active', 'is-playing');
                    return;
                }
                const fav = favorites[favIndex];
                if (fav) {
                    isActive = musicController.isCurrentRadioStation(fav.originalStationKey);
                }
            } else {
                isActive = musicController.isCurrentRadioStation(station);
            }
            button.classList.toggle('is-active', isActive);
            if (!isActive) { button.classList.remove('is-playing'); }
        });

        const amButton = document.querySelector('.radio-mode-btn-am') as HTMLButtonElement | null;
        if (!amButton) {return;}

        if (stationKey?.startsWith('am:') || stationKey?.startsWith('am-peru')) {
            const flagMatch = title.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
            const flag = flagMatch ? flagMatch[0] : 'AM';
            amButton.textContent = flag;
            amButton.classList.add('has-flag');
        } else {
            amButton.textContent = 'AM';
            amButton.classList.remove('has-flag');
        }

        updateFavoritesUI();
    }) as EventListener);

    // Listen for play/pause: toggle EQ animation (is-playing) on the active button
    window.addEventListener('atm_playback_changed', ((event: CustomEvent) => {
        const { isPlaying } = event.detail;
        radioButtons.forEach((button) => {
            if (button.classList.contains('is-active')) {
                button.classList.toggle('is-playing', isPlaying);
            } else {
                // Clean stale is-playing from non-active buttons
                button.classList.remove('is-playing');
            }
        });
    }) as EventListener);

    const showGlobalScreen = (target: 'search' | 'time' | 'game') => {
        // Remove active from ALL screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Activate the target screen
        if (target === 'search') {
            document.querySelector('#screen-search')?.classList.add('active');
        } else if (target === 'time') {
            document.querySelector('#screen-time')?.classList.add('active');
        } else if (target === 'game') {
            document.querySelector('#screen-game')?.classList.add('active');
        }

        // Update button styles
        quickAccessButtons.forEach((button) => {
            const isMusicButton = button === musicQuickButton;
            const isActive = isMusicButton ? target === 'search' : button.dataset.screen === target;
            button.classList.toggle('is-active', isActive);

            if (isActive) {
                button.setAttribute('aria-current', 'true');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    };

    // Back-to-search buttons (from Time/Game screens)
    const backToSearchButtons = Array.from(document.querySelectorAll('[data-back-to="search"]')) as HTMLButtonElement[];
    backToSearchButtons.forEach((button) => {
        button.addEventListener('click', () => {
            showGlobalScreen('search');
        });
    });

    // Quick Access button clicks
    quickAccessButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.screen;

            if (target === 'time' || target === 'game') {
                showGlobalScreen(target);
            }
        });
    });

    // Music tab now toggles UI mode (Music <-> Radio).
    if (musicQuickButton) {
        musicQuickButton.addEventListener('click', (e) => {
            e.stopPropagation();

            if (!document.querySelector('#screen-search')?.classList.contains('active')) {
                showGlobalScreen('search');
            }

            setAudioUiMode(audioUiMode === 'music' ? 'radio' : 'music');
        });
    }

    // Initial mode
    setAudioUiMode('radio');

    // The Search input Enter key is now fully handled inside search.ts ('MusicSearchUI')
}());

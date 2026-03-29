declare const acquireVsCodeApi: () => { postMessage: (message: unknown) => void };

import { createAtmMusicController } from '../../screens/atm-music/ui/index';
import { createAtmTimeController } from '../../screens/atm-time/ui/index';
import { initAtomPet } from '../../screens/atm-game/game';

(function () {
    const vscode = acquireVsCodeApi();

    // Mount Time and Game screens
    const atmTimeRoot = document.querySelector('#atm-time-root') as HTMLElement | null;
    const atmGameRoot = document.querySelector('#atm-game-root') as HTMLElement | null;


    if (atmGameRoot) {
        initAtomPet();
        
        // --- NICKNAME LOGIC ---
        const nicknameEl = document.querySelector('#atom-nickname') as HTMLElement | null;
        let currentNickname = localStorage.getItem('atm_game_nickname');

        const updateNicknameUI = (name: string) => {
            if (nicknameEl) nicknameEl.textContent = `@${name}`;
        };

        const modal = document.querySelector('#nickname-modal') as HTMLElement | null;
        const modalInput = document.querySelector('#nickname-input') as HTMLInputElement | null;
        const modalSaveBtn = document.querySelector('#nickname-save-btn') as HTMLButtonElement | null;
        const modalCloseBtn = document.querySelector('#nickname-close-btn') as HTMLButtonElement | null;

        const saveAndCloseModal = (rawName: string | null) => {
            const defaultName = currentNickname || 'Player';
            // If they cancel or leave empty, fallback to previous or default
            const safeName = (rawName !== null && rawName.trim() !== '') ? rawName : defaultName;
            const trimmed = safeName.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15) || 'Player';
            
            currentNickname = trimmed;
            localStorage.setItem('atm_game_nickname', currentNickname);
            updateNicknameUI(currentNickname);
            
            if (modal) modal.classList.add('hidden');
        };

        const showNicknameModal = () => {
            if (modal && modalInput) {
                modalInput.value = currentNickname || '';
                modal.classList.remove('hidden');
                setTimeout(() => modalInput.focus(), 100);
            }
        };

        if (modalSaveBtn && modalInput) {
            modalSaveBtn.addEventListener('click', () => saveAndCloseModal(modalInput.value));
            modalInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveAndCloseModal(modalInput.value);
            });
        }
        
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => saveAndCloseModal(null)); // null triggers fallback
        }

        if (!currentNickname) {
             // Only ask ONCE on first ever load via Modal
             showNicknameModal();
        } else {
             updateNicknameUI(currentNickname);
        }

        if (nicknameEl) {
             nicknameEl.addEventListener('click', showNicknameModal);
        }

        // Share Data logic
        const shareBtn = document.querySelector('#atom-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                // Placeholder for future data sharing
                vscode.postMessage({ 
                    type: 'open_screenshot', 
                    payload: { data: 'hello Data', nickname: currentNickname ? `@${currentNickname}` : '@Player' } 
                });
            });
        }
    }

    // Initialize Music Controller (handles search, results, player internally)
    const musicController = createAtmMusicController(vscode);

    // Initialize Time Controller (Pomodoro)
    const timeController = createAtmTimeController();

    // Quick Access buttons (Music / Time / Game)
    const quickAccessButtons = Array.from(document.querySelectorAll('.qa-btn')) as HTMLButtonElement[];
    const musicQuickButton = quickAccessButtons[0] || null;

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

    // "Music" label click → go to player/results if a track/search is active
    const musicLabel = document.querySelector('#qa-music-label') as HTMLElement | null;
    if (musicLabel) {
        musicLabel.addEventListener('click', (e) => {
            e.stopPropagation(); // don't bubble to the outer qa-btn
            musicController.goToMusic();
        });
    }

    // The Search input Enter key is now fully handled inside search.ts ('MusicSearchUI')
}());

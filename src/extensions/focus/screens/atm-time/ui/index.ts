import { PomodoroTimer, TimerMode } from '../core/timer';

export function createAtmTimeController() {
    const root = document.querySelector('#atm-time-root');
    if (!root) {
        return null;
    }

    const display = root.querySelector('#pomo-time-display') as HTMLElement;
    
    const btnPlay = root.querySelector('#pomo-btn-play') as HTMLButtonElement;
    const btnPause = root.querySelector('#pomo-btn-pause') as HTMLButtonElement;
    const btnReset = root.querySelector('#pomo-btn-reset') as HTMLButtonElement;
    const btnToggleMode = root.querySelector('#pomo-btn-toggle-mode') as HTMLButtonElement;
    
    let currentMode: TimerMode = 'focus';
    let isCurrentlyPlaying = false;
    let pomodorosCompleted = 0;

    const updateModeButtonText = (mode: TimerMode) => {
        if (btnToggleMode) {
            btnToggleMode.textContent = mode === 'focus' ? '5m' : '25m';
            btnToggleMode.title = mode === 'focus' ? 'Switch to Break (5m)' : 'Switch to Focus (25m)';
            
            // Highlight color in break mode to differentiate
            if (mode === 'focus') {
                btnToggleMode.style.color = 'var(--vscode-editor-foreground)';
                btnToggleMode.style.borderColor = 'var(--vscode-widget-border)';
            } else {
                btnToggleMode.style.color = 'var(--vscode-button-background)';
                btnToggleMode.style.borderColor = 'var(--vscode-button-background)';
            }
        }
    };

    const timer = new PomodoroTimer({
        onTick: (formattedTime, progressPercent) => {
            if (display) {
                if (formattedTime !== '00:00') {
                    display.classList.remove('timer-complete');
                }
                display.textContent = formattedTime;
            }
        },
        onStateChange: (isPlaying, mode) => {
            isCurrentlyPlaying = isPlaying;
            const displayWrapper = root.querySelector('.pomo-display-wrapper');
            if (displayWrapper) {
                if (isPlaying) {
                    displayWrapper.classList.add('is-playing');
                } else {
                    displayWrapper.classList.remove('is-playing');
                }
            }
            if (isPlaying) {
                if (btnPlay) {
                    btnPlay.style.display = 'none';
                }
                if (btnPause) {
                    btnPause.style.display = 'flex';
                }
            } else {
                if (btnPlay) {
                    btnPlay.style.display = 'flex';
                }
                if (btnPause) {
                    btnPause.style.display = 'none';
                }
            }
            updateModeButtonText(mode);
            currentMode = mode;
        },
        onEnd: () => {
            if (currentMode === 'focus') {
                pomodorosCompleted++;
            }
            // Smooth natural transition to blue gradient when time ends
            if (display) {
                display.classList.add('timer-complete');
            }
        }
    });

    (timer as any).getCompletedPomodoros = () => pomodorosCompleted;

    // Event Listeners
    btnPlay?.addEventListener('click', () => timer.play());
    btnPause?.addEventListener('click', () => timer.pause());
    btnReset?.addEventListener('click', () => timer.reset());
    
    btnToggleMode?.addEventListener('click', () => {
        const nextMode = currentMode === 'focus' ? 'break' : 'focus';
        timer.setMode(nextMode);
    });

    // Init styles based on default focus mode
    updateModeButtonText('focus');

    // Spacebar shortcut for Play/Pause (only when Time screen is active)
    const handleKeyDown = (e: KeyboardEvent) => {
        const timeScreen = document.getElementById('screen-time');
        const isActive = timeScreen && window.getComputedStyle(timeScreen).display !== 'none';
        
        // Prevent trigger when typing in inputs or editable areas
        const isInputFocused = document.activeElement && (
            ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || 
            (document.activeElement as HTMLElement).isContentEditable
        );

        if (e.code === 'Space' && isActive && !isInputFocused) {
            e.preventDefault(); // Prevent default scroll jump
            
            const targetBtn = isCurrentlyPlaying ? btnPause : btnPlay;
            
            // Visual click simulation
            targetBtn?.classList.add('btn-press');
            setTimeout(() => targetBtn?.classList.remove('btn-press'), 120);

            // Toggle logic
            if (isCurrentlyPlaying) {
                timer.pause();
            } else {
                timer.play();
            }
        }
    };

    // Cleanup previous listener if it exists to prevent memory leaks
    if ((window as any).__atmTimeCleanup) {
        (window as any).__atmTimeCleanup();
    }

    document.addEventListener('keydown', handleKeyDown);
    
    // Store cleanup function
    (window as any).__atmTimeCleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
    };

    return timer;
}


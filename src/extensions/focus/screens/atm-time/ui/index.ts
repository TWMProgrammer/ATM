import { PomodoroTimer, TimerMode } from '../core/timer';

export function createAtmTimeController() {
    const root = document.querySelector('#atm-time-root');
    if (!root) return null;

    const display = root.querySelector('#pomo-time-display') as HTMLElement;
    
    const btnPlay = root.querySelector('#pomo-btn-play') as HTMLButtonElement;
    const btnPause = root.querySelector('#pomo-btn-pause') as HTMLButtonElement;
    const btnReset = root.querySelector('#pomo-btn-reset') as HTMLButtonElement;
    const btnToggleMode = root.querySelector('#pomo-btn-toggle-mode') as HTMLButtonElement;
    
    let currentMode: TimerMode = 'focus';

    const updateModeButtonText = (mode: TimerMode) => {
        if (btnToggleMode) {
            btnToggleMode.textContent = mode === 'focus' ? '25m' : '5m';
            btnToggleMode.title = mode === 'focus' ? 'Switch to Break (5m)' : 'Switch to Focus (25m)';
            
            // Highlight color in break mode to differentiate
            if (mode === 'focus') {
                btnToggleMode.style.color = 'var(--vscode-editor-foreground)';
                btnToggleMode.style.borderColor = 'var(--vscode-widget-border)';
            } else {
                btnToggleMode.style.color = 'var(--vscode-charts-blue, #3794ff)';
                btnToggleMode.style.borderColor = 'var(--vscode-charts-blue, #3794ff)';
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
            if (isPlaying) {
                if (btnPlay) btnPlay.style.display = 'none';
                if (btnPause) btnPause.style.display = 'flex';
            } else {
                if (btnPlay) btnPlay.style.display = 'flex';
                if (btnPause) btnPause.style.display = 'none';
            }
            updateModeButtonText(mode);
            currentMode = mode;
        },
        onEnd: () => {
            // Smooth natural transition to blue gradient when time ends
            if (display) {
                display.classList.add('timer-complete');
            }
        }
    });

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

    return timer;
}

export type TimerMode = 'focus' | 'break';

export interface TimerCallbacks {
    onTick: (formattedTime: string, progressPercent: number) => void;
    onEnd: () => void;
    onStateChange: (isPlaying: boolean, mode: TimerMode) => void;
}

export class PomodoroTimer {
    private durationMinutes: number;
    private remainingSeconds: number;
    private totalSeconds: number;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private mode: TimerMode = 'focus';
    private isPlaying: boolean = false;
    private callbacks: TimerCallbacks;
    private endTime: number | null = null;

    constructor(callbacks: TimerCallbacks) {
        this.callbacks = callbacks;
        this.durationMinutes = 25; // default focus
        this.totalSeconds = this.durationMinutes * 60;
        this.remainingSeconds = this.totalSeconds;
    }

    public setMode(mode: TimerMode) {
        this.pause();
        this.mode = mode;
        this.durationMinutes = mode === 'focus' ? 25 : 5;
        this.totalSeconds = this.durationMinutes * 60;
        this.remainingSeconds = this.totalSeconds;
        this.notifyTick();
        this.callbacks.onStateChange(this.isPlaying, this.mode);
    }

    public play() {
        if (this.isPlaying || this.remainingSeconds <= 0) {
            if (this.remainingSeconds <= 0) {
                this.reset();
            } else {
                return;
            }
        }
        
        this.isPlaying = true;
        this.endTime = Date.now() + (this.remainingSeconds * 1000);
        this.callbacks.onStateChange(this.isPlaying, this.mode);
        
        // Immediate tick to show starting state
        this.notifyTick();

        this.intervalId = setInterval(() => {
            if (!this.endTime) return;
            
            const now = Date.now();
            this.remainingSeconds = Math.max(0, Math.round((this.endTime - now) / 1000));
            
            this.notifyTick();

            if (this.remainingSeconds <= 0) {
                this.pause();
                this.callbacks.onEnd();
            }
        }, 200); // Check more frequently for higher precision
    }

    public pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.endTime = null;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.callbacks.onStateChange(this.isPlaying, this.mode);
    }

    public reset() {
        this.pause();
        this.remainingSeconds = this.totalSeconds;
        this.notifyTick();
        this.callbacks.onStateChange(this.isPlaying, this.mode);
    }

    private notifyTick() {
        const minutes = Math.floor(this.remainingSeconds / 60);
        const seconds = this.remainingSeconds % 60;
        const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const progress = ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100;
        this.callbacks.onTick(formatted, progress);
    }
}


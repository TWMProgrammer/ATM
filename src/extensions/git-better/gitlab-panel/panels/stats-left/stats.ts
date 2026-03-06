import type { StatsData } from '../../shared/types';

/**
 * Stats / Metrics panel logic — manages the left sidebar badges.
 * Replaces skeleton loaders with real numbers using smooth transitions.
 */

class StatsManager {
    private vscode: any;
    private hasRendered = false;

    constructor() {
        // @ts-ignore
        this.vscode = (window as any).vscodeApi;
        this.init();
    }

    private init() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'renderStats' && message.data && !this.hasRendered) {
                this.updateStats(message.data);
                this.hasRendered = true;
            }
        });
    }

    private updateStats(data: StatsData) {
        const staggerDelay = 60; // ms between each stat appearing
        const entries: [string, number][] = [
            ['stats-branches', data.branches],
            ['stats-commits', data.commits],
            ['stats-tags', data.tags],
            ['stats-stashes', data.stashes],
        ];

        entries.forEach(([id, value], index) => {
            setTimeout(() => this.setStatValue(id, value), index * staggerDelay);
        });
    }

    private setStatValue(elementId: string, value: number) {
        const el = document.getElementById(elementId);
        if (!el) { return; }

        // Phase 1: fade out skeleton smoothly
        el.style.opacity = '0';

        // Phase 2: after fade-out, swap content and fade in
        setTimeout(() => {
            // Sanitize: ensure value is a safe number
            const safeValue = typeof value === 'number' && isFinite(value) ? value : 0;
            el.textContent = this.formatNumber(Math.max(0, Math.floor(safeValue)));
            el.style.opacity = '1';
        }, 250); // synced with CSS transition duration (0.25s)
    }

    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new StatsManager();
    });
} else {
    new StatsManager();
}

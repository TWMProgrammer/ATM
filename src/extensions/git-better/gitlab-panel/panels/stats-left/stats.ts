import type { StatsData } from '../../shared/types';

/**
 * Stats / Metrics panel logic — manages the left sidebar badges
 * Replaces the skeleton loaders with real numbers (and shortens them contextually like 1.5k)
 */
class StatsManager {
    private vscode: any;

    constructor() {
        // @ts-ignore
        this.vscode = (window as any).vscodeApi;
        this.init();
    }

    private init() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'renderStats' && message.data) {
                this.updateStats(message.data);
            }
        });

        if (this.vscode) {
            // Already called by others, but harmless to ask again guaranteeing delivery
            this.vscode.postMessage({ type: 'ready' });
        }
    }

    private updateStats(data: StatsData) {
        this.setStatValue('stats-branches', data.branches);
        this.setStatValue('stats-commits', data.commits);
        this.setStatValue('stats-tags', data.tags);
        this.setStatValue('stats-stashes', data.stashes);
    }

    private setStatValue(elementId: string, value: number) {
        const el = document.getElementById(elementId);
        if (el) {
            // Quick subtle fade-out of the skeleton
            el.style.opacity = '0';
            
            setTimeout(() => {
                // Shorten large numbers (1500 to 1.5k) for aesthetic UI design
                el.textContent = this.formatNumber(value);
                
                // Fade-in real number
                el.style.opacity = '1';
                el.style.transition = 'opacity 0.2s ease-in';
            }, 100);
        }
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

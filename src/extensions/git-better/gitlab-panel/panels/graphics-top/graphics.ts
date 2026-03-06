/**
 * Graphics panel logic — manages the display of the commit activity sparkline
 * Handles skeleton fading and real data injection.
 */

class GraphicsManager {
    private vscode: any;
    private skeletonContainer: HTMLElement | null;
    private graphContainer: HTMLElement | null;

    constructor() {
        // @ts-ignore - window.vscodeApi is injected in index.html
        this.vscode = (window as any).vscodeApi;
        this.skeletonContainer = document.getElementById('graphics-skeleton-container');
        this.graphContainer = document.getElementById('graphics-graph-container');
        
        this.init();
    }

    private init() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                // When we receive commit data or graph data, display the real graph
                case 'renderCommit':
                case 'renderGraphics':
                    this.showRealData();
                    break;
            }
        });

        // Request initial data, assuming there's a listener that responds to "ready"
        if (this.vscode) {
            this.vscode.postMessage({ type: 'ready' });
        }
    }

    private showRealData() {
        // Fade out skeleton
        if (this.skeletonContainer) {
            this.skeletonContainer.style.opacity = '0';
            setTimeout(() => {
                if (this.skeletonContainer) {
                    this.skeletonContainer.style.display = 'none';
                }
            }, 300); // match transition duration
        }

        // Fade in real graph
        if (this.graphContainer) {
            this.graphContainer.style.opacity = '1';
        }
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GraphicsManager();
    });
} else {
    new GraphicsManager();
}

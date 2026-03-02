/**
 * Manages the collapsible behavior of the Inspect Panel and Top Toolbar expansion.
 */
export class PanelManager {
    private vscode: any;
    private isPanelCollapsed = false;
    private isExpanded = false;

    constructor() {
        // @ts-ignore - acquireVsCodeApi is available in the webview
        this.vscode = acquireVsCodeApi();
        this.init();
    }

    private init() {
        const expandBtn = document.getElementById('expand-btn');
        const inspectPanel = document.getElementById('inspect-panel');
        const inspectToggle = document.getElementById('inspect-toggle');

        // ── Expand/Collapse main panel (Bottom Panel Maximize) ──
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.isExpanded = !this.isExpanded;
                expandBtn.classList.toggle('expanded', this.isExpanded);
                expandBtn.title = this.isExpanded ? 'Collapse' : 'Expand';
                this.vscode.postMessage({ type: 'toggleExpand', expanded: this.isExpanded });
            });
        }

        // ── Inspect Panel Toggle (GPU-Accelerated Slide) ──
        if (inspectToggle && inspectPanel) {
            inspectToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleInspectPanel();
            });

            // Click anywhere on the bar when collapsed to expand it
            inspectPanel.addEventListener('click', () => {
                if (this.isPanelCollapsed) {
                    this.toggleInspectPanel();
                }
            });
        }
    }

    private toggleInspectPanel() {
        const inspectPanel = document.getElementById('inspect-panel');
        const inspectToggle = document.getElementById('inspect-toggle');
        const icon = inspectToggle?.querySelector('.toggle-icon') as HTMLElement;

        this.isPanelCollapsed = !this.isPanelCollapsed;
        
        if (inspectPanel) {
            inspectPanel.classList.toggle('collapsed', this.isPanelCollapsed);
        }

        if (inspectToggle) {
            inspectToggle.title = this.isPanelCollapsed ? 'Expand panel' : 'Collapse panel';
        }

        // Swap SVG icon via mask-image
        if (icon) {
            const iconName = this.isPanelCollapsed ? 'arrow-left.svg' : 'arrow-right.svg';
            // @ts-ignore - ASSETS_URI is injected by the template builder
            const assetsUri = window.ASSETS_URI || '{{ASSETS_URI}}';
            const newUrl = `url('${assetsUri}/icons/${iconName}')`;
            icon.style.webkitMaskImage = newUrl;
            icon.style.maskImage = newUrl;
        }
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PanelManager());
} else {
    new PanelManager();
}

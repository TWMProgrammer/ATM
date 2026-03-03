/**
 * Manages the Inspect Panel logic, handling incoming state updates and
 * communicating actions correctly to the main VS Code extension backend.
 */

// Define the shape of our commit data representing the selected state
export interface InspectCommitData {
    hash: string;
    authorName: string;
    authorAvatar: string;
    message: string;
    date: string;
    stats: {
        added: number;
        deleted: number;
    };
    files: Array<{
        status: string; // e.g., 'M', 'A', 'D'
        name: string;
    }>;
}

export class InspectManager {
    private vscode: any;
    private currentHash: string | null = null;

    constructor() {
        // @ts-ignore - acquireVsCodeApi is available in the webview
        this.vscode = acquireVsCodeApi();
        this.init();
    }

    private init() {
        // 1. Listen for messages from the extension Backend
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'renderCommit':
                    if (message.data) {
                        this.updateInspectPanel(message.data);
                    }
                    break;
            }
        });

        // 2. Bind the UI actions to VS Code commands
        const btnExplain = document.getElementById('btn-explain');
        if (btnExplain) {
            btnExplain.addEventListener('click', () => {
                if (this.currentHash) {
                    this.vscode.postMessage({ 
                        type: 'explainCommit', 
                        hash: this.currentHash 
                    });
                }
            });
        }
    }

    /**
     * Updates all dynamic text correctly without destroying the DOM structure.
     */
    private updateInspectPanel(data: InspectCommitData) {
        this.currentHash = data.hash;

        this.setTextInfo('inspect-commit-hash', data.hash.substring(0, 7));
        this.setTextInfo('inspect-author-name', data.authorName);
        this.setTextInfo('inspect-author-avatar', data.authorAvatar);
        this.setTextInfo('inspect-commit-title', data.message);
        this.setTextInfo('inspect-commit-date', data.date);
        
        // Correct formatting logic
        const fileCountText = data.files.length === 1 ? '1 FILE CHANGED' : `${data.files.length} FILES CHANGED`;
        this.setTextInfo('inspect-files-count-text', fileCountText);
        
        this.setTextInfo('inspect-stats-add', `+${data.stats.added}`);
        this.setTextInfo('inspect-stats-del', `-${data.stats.deleted}`);

        this.renderFileList(data.files);
    }

    /**
     * Helper cleanly updates text content if element exists.
     */
    private setTextInfo(id: string, text: string) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    /**
     * Efficiently builds the file list HTML.
     */
    private renderFileList(files: InspectCommitData['files']) {
        const listEl = document.getElementById('inspect-file-list');
        if (!listEl) {
            return;
        }

        // @ts-ignore
        const assetsUri = window.ASSETS_URI || '';

        const html = files.map(file => {
            // Give different colors depending on action status if desired.
            const statusColor = file.status === 'D' ? 'var(--accent-red)' : 
                                file.status === 'A' ? 'var(--accent-green)' : 
                                'var(--accent-blue)';

            return `
                <li>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: ${statusColor}; font-weight: bold;">${file.status}</span>
                        <span>${file.name}</span>
                    </div>
                    <div class="icon-mask" style="--icon-size: 14px; opacity: 0.7; cursor: pointer; -webkit-mask-image: url('${assetsUri}/icons/eye.svg'); mask-image: url('${assetsUri}/icons/eye.svg');" title="View File"></div>
                </li>
            `;
        }).join('');

        // Apply new elements using fast native parse
        listEl.innerHTML = html;
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new InspectManager());
} else {
    new InspectManager();
}

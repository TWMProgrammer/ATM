/**
 * Manages the Inspect Panel logic, handling incoming state updates and
 * communicating actions correctly to the main VS Code extension backend.
 */

// Define the shape of our commit data representing the selected state
export interface InspectCommitData {
    hash: string;
    authorName: string;
    authorAvatar: string;
    authorAvatarUrl?: string | null;
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
    githubUrl: string | null;
}

export class InspectManager {
    private vscode: any;
    private currentHash: string | null = null;
    private currentGithubUrl: string | null = null;

    constructor() {
        // @ts-ignore - window.vscodeApi is injected in index.html
        this.vscode = (window as any).vscodeApi;
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
        const btnCopy = document.getElementById('btn-copy');
        const btnCopyText = document.getElementById('btn-copy-text');
        const btnCopyIcon = document.getElementById('btn-copy-icon');

        if (btnCopy && btnCopyText && btnCopyIcon) {
            btnCopy.addEventListener('click', () => {
                if (this.currentHash) {
                    this.vscode.postMessage({ 
                        type: 'copyCommit', 
                        hash: this.currentHash 
                    });

                    // Visual Feedback
                    const originalText = btnCopyText.textContent;
                    const originalColor = btnCopyIcon.style.backgroundColor;
                    const originalMask = btnCopyIcon.style.maskImage || btnCopyIcon.style.webkitMaskImage;

                    // @ts-ignore
                    const assetsUri = window.ASSETS_URI || '';

                    btnCopyText.textContent = 'Copied!';
                    btnCopyText.style.color = 'var(--vscode-charts-green, #4caf50)';
                    btnCopyIcon.style.backgroundColor = 'var(--vscode-charts-green, #4caf50)';
                    
                    // Switch to checks icon
                    btnCopyIcon.style.webkitMaskImage = `url('${assetsUri}/icons/checks.svg')`;
                    btnCopyIcon.style.maskImage = `url('${assetsUri}/icons/checks.svg')`;
                    
                    btnCopy.style.borderColor = 'var(--vscode-charts-green, #4caf50)';
                    btnCopy.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                    
                    setTimeout(() => {
                        if (btnCopyText.textContent === 'Copied!') {
                            btnCopyText.textContent = originalText;
                            btnCopyText.style.color = '';
                            btnCopyIcon.style.backgroundColor = originalColor;
                            
                            // Restore original icon
                            btnCopyIcon.style.webkitMaskImage = originalMask;
                            btnCopyIcon.style.maskImage = originalMask;
                            
                            btnCopy.style.borderColor = '';
                            btnCopy.style.backgroundColor = '';
                        }
                    }, 2000);
                }
            });
        }

        const btnGithub = document.querySelector('.inspect-title');
        if (btnGithub) {
            btnGithub.addEventListener('click', () => {
                if (this.currentGithubUrl) {
                    this.vscode.postMessage({
                        type: 'openCommitOnGithub',
                        url: this.currentGithubUrl
                    });
                }
            });
        }

        // 3. Request initial data when UI is ready
        this.vscode.postMessage({ type: 'ready' });
    }

    /**
     * Updates all dynamic text correctly without destroying the DOM structure.
     */
    private updateInspectPanel(data: InspectCommitData) {
        this.currentHash = data.hash;
        this.currentGithubUrl = data.githubUrl;

        this.setTextInfo('inspect-commit-hash', data.hash.substring(0, 7));
        this.setTextInfo('inspect-author-name', data.authorName);
        this.setTextInfo('inspect-commit-title', data.message);
        this.setTextInfo('inspect-commit-date', data.date);
        
        // Handle Avatar logic separately
        const avatarEl = document.getElementById('inspect-author-avatar');
        if (avatarEl) {
            avatarEl.classList.remove('skeleton-box');
            if (data.authorAvatarUrl) {
                avatarEl.innerHTML = `<img src="${data.authorAvatarUrl}" alt="${data.authorName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                avatarEl.style.backgroundColor = 'transparent';
                avatarEl.style.color = 'transparent';
            } else {
                avatarEl.innerHTML = '';
                avatarEl.textContent = data.authorAvatar;
                avatarEl.style.backgroundColor = ''; // Restore to default CSS
                avatarEl.style.color = '';
            }
        }
        
        // Correct formatting logic
        const fileCountText = data.files.length === 1 ? '1 FILE CHANGED' : `${data.files.length} FILES CHANGED`;
        this.setTextInfo('inspect-files-count-text', fileCountText);
        
        this.setTextInfo('inspect-stats-add', `+${data.stats.added}`);
        this.setTextInfo('inspect-stats-del', `-${data.stats.deleted}`);

        this.renderFileList(data.files);
    }

    /**
     * Helper cleanly updates text content and removes skeleton classes if element exists.
     */
    private setTextInfo(id: string, text: string) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('skeleton-box');
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

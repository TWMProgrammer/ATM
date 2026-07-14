/**
 * Inspect Panel — Manages commit details display and panel collapse/expand.
 * Combines InspectManager + PanelToggle logic.
 */
import type { InspectCommitData } from '../../shared/types';

// ── Inspect Panel Toggle ─────────────────────────────────
class InspectPanelToggle {
    private isPanelCollapsed = false;

    constructor() {
        const inspectPanel = document.getElementById('inspect-panel');
        const inspectToggle = document.getElementById('inspect-toggle');

        if (inspectToggle && inspectPanel) {
            inspectToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });

            inspectPanel.addEventListener('click', () => {
                if (this.isPanelCollapsed) {
                    this.toggle();
                }
            });

            // narrow (vertical) panel: drawer overlays the table, start collapsed
            if (window.matchMedia('(max-width: 640px)').matches) {
                this.toggle();
            }
        }
    }

    private toggle() {
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

// ── Inspect Manager ──────────────────────────────────────
class InspectManager {
    private vscode: any;
    private currentHash: string | null = null;
    private currentGithubUrl: string | null = null;
    private pendingHash: string | null = null;

    constructor() {
        // @ts-ignore - window.vscodeApi is injected in index.html
        this.vscode = (window as any).vscodeApi;
        this.init();
    }

    private init() {
        // Listen for messages from the extension backend
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'renderCommit':
                    if (message.data) {
                        // Ignore stale responses if the user clicked another commit in the meantime
                        if (this.pendingHash && this.pendingHash !== message.data.hash) { return; }

                        this.setUpdating(false);
                        this.updateInspectPanel(message.data);
                    }
                    break;
            }
        });

        // Listen for commit selection from commits panel (show loading immediately)
        window.addEventListener('commitSelected', (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.hash) {
                this.pendingHash = customEvent.detail.hash;
            }
            this.setUpdating(true);
        });

        // Copy button
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

                    // Visual feedback
                    const originalText = btnCopyText.textContent;
                    const originalColor = btnCopyIcon.style.backgroundColor;
                    const originalMask = btnCopyIcon.style.maskImage || btnCopyIcon.style.webkitMaskImage;

                    // @ts-ignore
                    const assetsUri = window.ASSETS_URI || '';

                    btnCopyText.textContent = 'Copied!';
                    btnCopyText.style.color = 'var(--vscode-charts-green, #4caf50)';
                    btnCopyIcon.style.backgroundColor = 'var(--vscode-charts-green, #4caf50)';

                    btnCopyIcon.style.webkitMaskImage = `url('${assetsUri}/icons/checks.svg')`;
                    btnCopyIcon.style.maskImage = `url('${assetsUri}/icons/checks.svg')`;

                    btnCopy.style.borderColor = 'var(--vscode-charts-green, #4caf50)';
                    btnCopy.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';

                    setTimeout(() => {
                        if (btnCopyText.textContent === 'Copied!') {
                            btnCopyText.textContent = originalText;
                            btnCopyText.style.color = '';
                            btnCopyIcon.style.backgroundColor = originalColor;
                            btnCopyIcon.style.webkitMaskImage = originalMask;
                            btnCopyIcon.style.maskImage = originalMask;
                            btnCopy.style.borderColor = '';
                            btnCopy.style.backgroundColor = '';
                        }
                    }, 2000);
                }
            });
        }

        // GitHub link
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

        // Request initial data
        this.vscode.postMessage({ type: 'ready' });
    }

    private setUpdating(isUpdating: boolean) {
        const panel = document.getElementById('inspect-panel');
        if (panel) {
            panel.classList.toggle('updating', isUpdating);
        }
    }

    private updateInspectPanel(data: InspectCommitData) {
        this.currentHash = data.hash;
        this.currentGithubUrl = data.githubUrl;

        this.setTextInfo('inspect-commit-hash', data.hash.substring(0, 7));
        this.setTextInfo('inspect-author-name', data.authorName);
        this.setTextInfo('inspect-commit-title', data.message);
        this.setTextInfo('inspect-commit-date', data.date);

        // Avatar
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
                avatarEl.style.backgroundColor = '';
                avatarEl.style.color = '';
            }
        }

        const fileCountText = data.files.length === 1 ? '1 FILE CHANGED' : `${data.files.length} FILES CHANGED`;
        this.setTextInfo('inspect-files-count-text', fileCountText);
        this.setTextInfo('inspect-stats-add', `+${data.stats.added}`);
        this.setTextInfo('inspect-stats-del', `-${data.stats.deleted}`);

        this.renderFileList(data.files);
    }

    private setTextInfo(id: string, text: string) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('skeleton-box');
            el.textContent = text;
        }
    }

    private renderFileList(files: InspectCommitData['files']) {
        const listEl = document.getElementById('inspect-file-list');
        if (!listEl) { return; }

        // @ts-ignore
        const assetsUri = window.ASSETS_URI || '';

        const html = files.map(file => {
            const statusColor = file.status === 'D' ? 'var(--accent-red)' :
                                file.status === 'A' ? 'var(--accent-green)' :
                                'var(--accent-blue)';

            return `
                <li>
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; padding-right: 12px;">
                        <span style="color: ${statusColor}; font-weight: bold; flex-shrink: 0;">${file.status}</span>
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left;">&lrm;${file.name}&lrm;</span>
                    </div>
                    <div class="icon-mask" style="--icon-size: 14px; opacity: 0.7; flex-shrink: 0; -webkit-mask-image: url('${assetsUri}/icons/eye.svg'); mask-image: url('${assetsUri}/icons/eye.svg');"></div>
                </li>
            `;
        }).join('');

        listEl.innerHTML = html;
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new InspectPanelToggle();
        new InspectManager();
    });
} else {
    new InspectPanelToggle();
    new InspectManager();
}

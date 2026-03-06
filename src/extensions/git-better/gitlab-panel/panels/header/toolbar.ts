/**
 * Toolbar logic — SearchBox + Expand button
 */

// ── SearchBox ────────────────────────────────────────────
class SearchBox {
    private input: HTMLInputElement | null;
    private clearBtn: HTMLElement | null;

    constructor() {
        this.input = document.querySelector('.search-box input');
        this.clearBtn = document.getElementById('search-clear');

        if (this.input && this.clearBtn) {
            this.init();
        }
    }

    private init() {
        if (!this.input || !this.clearBtn) { return; }

        this.updateClearButtonVisibility();

        this.input.addEventListener('input', () => {
            this.updateClearButtonVisibility();
        });

        this.clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.input) {
                this.input.value = '';
                this.updateClearButtonVisibility();
                this.input.focus();
            }
        });
    }

    private updateClearButtonVisibility() {
        if (!this.input || !this.clearBtn) { return; }

        if (this.input.value.length > 0) {
            this.clearBtn.classList.add('visible');
        } else {
            this.clearBtn.classList.remove('visible');
        }
    }
}

// ── Expand Button ────────────────────────────────────────
class ExpandButton {
    private vscode: any;
    private isExpanded = false;

    constructor() {
        // @ts-ignore - window.vscodeApi is injected in index.html
        this.vscode = (window as any).vscodeApi;

        const expandBtn = document.getElementById('expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.isExpanded = !this.isExpanded;
                expandBtn.classList.toggle('expanded', this.isExpanded);
                expandBtn.title = this.isExpanded ? 'Collapse' : 'Expand';
                this.vscode.postMessage({ type: 'toggleExpand', expanded: this.isExpanded });
            });
        }
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SearchBox();
        new ExpandButton();
    });
} else {
    new SearchBox();
    new ExpandButton();
}

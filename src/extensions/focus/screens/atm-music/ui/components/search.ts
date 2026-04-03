import { $, escapeHtml } from '../../../../shared/utils';

export type SearchButtonMode = 'disabled' | 'search' | 'forward';

export class MusicSearchUI {
    private searchInput: HTMLInputElement | null = null;
    private searchBtn: HTMLButtonElement | null = null;
    private lastSearchQuery = '';
    private canForward = false;
    private mode: SearchButtonMode = 'disabled';
    private isLocked = false;

    constructor(
        private readonly onSearch: (query: string) => void,
        private readonly onForward: () => void
    ) {
        this.searchInput = $('#search-input') as HTMLInputElement | null;
        this.searchBtn = $('#search-btn') as HTMLButtonElement | null;
        this.setupEvents();
        this.updateState();
    }

    public getQuery(): string {
        return (this.searchInput?.value || '').trim();
    }

    public setQuery(query: string) {
        if (this.searchInput) {
            this.searchInput.value = query;
            this.lastSearchQuery = query;
            this.updateState();
        }
    }

    public setCanForward(enabled: boolean) {
        this.canForward = enabled;
        this.updateState();
    }

    private setupEvents() {
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => {
                if (this.mode === 'forward') {
                    this.onForward();
                    return;
                }
                const query = this.getQuery();
                if (query) {
                    this.lastSearchQuery = query;
                    this.onSearch(query);
                }
            });
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.updateState());
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.mode === 'forward') {
                        this.onForward();
                        return;
                    }
                    const query = this.getQuery();
                    if (query) {
                        this.lastSearchQuery = query;
                        this.onSearch(query);
                    }
                }
            });
        }
    }

    public setLocked(isLocked: boolean) {
        this.isLocked = isLocked;
        if (this.searchInput) {
            this.searchInput.placeholder = isLocked ? '🔑 Paste your YouTube API key here...' : 'BETA - Search for music...';
            if (isLocked) {this.searchInput.value = '';}
        }
        this.updateState();
    }

    private updateState() {
        if (!this.searchBtn) {return;}

        const currentQuery = this.getQuery();
        const isUnchanged = currentQuery === this.lastSearchQuery && currentQuery.length > 0;
        const isForward = this.canForward && isUnchanged && !this.isLocked;

        if (currentQuery.length === 0) {
            this.mode = 'disabled';
        } else if (isForward) {
            this.mode = 'forward';
        } else {
            this.mode = 'search';
        }

        const isDisabled = this.mode === 'disabled';
        this.searchBtn.disabled = isDisabled;
        this.searchBtn.classList.toggle('is-disabled', isDisabled);

        if (this.mode === 'forward') {
            this.searchBtn.setAttribute('aria-label', 'Go forward to results');
            this.searchBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
        } else if (this.mode === 'search') {
            this.searchBtn.setAttribute('aria-label', this.isLocked ? 'Save API Key' : 'Search');
            this.searchBtn.innerHTML = this.isLocked ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
        } else {
            this.searchBtn.setAttribute('aria-label', 'Empty search');
            this.searchBtn.innerHTML = this.isLocked ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
        }
    }
}

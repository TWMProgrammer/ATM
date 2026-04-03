import { $ } from '../../../../shared/utils';

export type SearchButtonMode = 'disabled' | 'search' | 'forward';

export class MusicSearchUI {
    private searchContainer: HTMLElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private searchBtn: HTMLButtonElement | null = null;
    private lastSearchQuery = '';
    private canForward = false;
    private mode: SearchButtonMode = 'disabled';
    private isLocked = false;
    private isApiValidationLoading = false;
    private apiValidationFailed = false;
    private apiValidationToken = 0;

    constructor(
        private readonly onSearch: (query: string) => void,
        private readonly onForward: () => void
    ) {
        this.searchContainer = document.querySelector('#screen-search .search-container') as HTMLElement | null;
        this.searchInput = $('#search-input') as HTMLInputElement | null;
        this.searchBtn = $('#search-btn') as HTMLButtonElement | null;
        this.setupEvents();
        this.updateState();
    }

    public startApiValidationLoading() {
        if (!this.isLocked || this.isApiValidationLoading) {return;}
        this.isApiValidationLoading = true;
        this.apiValidationFailed = false;
        this.apiValidationToken++;
        this.searchContainer?.classList.add('api-loading');
        if (this.searchInput) {
            this.searchInput.readOnly = true;
            this.searchInput.classList.remove('fading-out');
        }
        this.updateState();
    }

    public finishApiValidationLoading(isSuccess: boolean): Promise<void> {
        const token = this.apiValidationToken;
        const waitMs = 0;

        return new Promise((resolve) => {
            window.setTimeout(() => {
                if (token !== this.apiValidationToken) {
                    resolve();
                    return;
                }

                this.isApiValidationLoading = false;
                this.searchContainer?.classList.remove('api-loading');
                if (this.searchInput) {
                    this.searchInput.readOnly = false;
                }

                if (isSuccess && this.searchInput && this.searchInput.value.trim().length > 0) {
                    this.apiValidationFailed = false;
                    this.searchInput.classList.add('fading-out');
                    window.setTimeout(() => {
                        if (token !== this.apiValidationToken) {
                            resolve();
                            return;
                        }
                        if (this.searchInput) {
                            this.searchInput.value = '';
                            this.lastSearchQuery = '';
                            this.searchInput.classList.remove('fading-out');
                        }
                        this.updateState();
                        resolve();
                    }, 320);
                    return;
                }

                if (!isSuccess) {
                    this.apiValidationFailed = true;
                    if (this.searchInput) {
                        this.searchInput.value = '';
                        this.lastSearchQuery = '';
                        this.searchInput.classList.remove('fading-out');
                    }
                }

                this.updateState();
                resolve();
            }, waitMs);
        });
    }

    public resetApiValidationFeedback() {
        this.apiValidationToken++;
        this.isApiValidationLoading = false;
        this.apiValidationFailed = false;
        this.searchContainer?.classList.remove('api-loading');
        if (this.searchInput) {
            this.searchInput.readOnly = false;
            this.searchInput.classList.remove('fading-out');
        }
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
            this.searchInput.addEventListener('input', () => {
                if (this.apiValidationFailed && this.getQuery().length > 0) {
                    this.apiValidationFailed = false;
                }
                this.updateState();
            });
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
        if (!isLocked) {
            this.apiValidationFailed = false;
            this.searchContainer?.classList.remove('api-loading');
        }
        if (this.searchInput) {
            this.searchInput.placeholder = isLocked ? '🔑 Paste your YouTube API key here...' : 'BETA - Search for music...';
            this.updateState();
        } else {
            this.updateState();
        }
    }

    private updateState() {
        if (!this.searchBtn) {return;}

        this.searchBtn.classList.remove('is-api-error');

        if (this.isApiValidationLoading) {
            this.mode = 'search';
            this.searchBtn.disabled = true;
            this.searchBtn.classList.add('is-disabled');
            this.searchBtn.setAttribute('aria-label', 'Validating API key');
            this.searchBtn.innerHTML = '<span class="search-btn-loader" aria-hidden="true"></span>';
            return;
        }

        if (this.isLocked) {
            const currentQuery = this.getQuery();
            const hasValue = currentQuery.length > 0;

            if (this.apiValidationFailed) {
                this.mode = 'search';
                this.searchBtn.disabled = false;
                this.searchBtn.classList.remove('is-disabled');
                this.searchBtn.classList.add('is-api-error');
                this.searchBtn.setAttribute('aria-label', 'Invalid API key');
                this.searchBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                return;
            }

            this.mode = hasValue ? 'search' : 'disabled';
            this.searchBtn.disabled = !hasValue;
            this.searchBtn.classList.toggle('is-disabled', !hasValue);
            this.searchBtn.setAttribute('aria-label', hasValue ? 'Validate API key' : 'Paste API key');
            this.searchBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            return;
        }

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

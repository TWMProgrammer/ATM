import type { CommitRowData } from '../../shared/types';

/**
 * Commits panel — renders the commit table with infinite scroll.
 * Also manages the Git Graph SVG overlay.
 */
class CommitsManager {
    private vscode: any;
    private tableBody: HTMLElement | null;
    private overlay: HTMLDivElement | null;
    private svgNamespace = 'http://www.w3.org/2000/svg';
    private resizeObserver: ResizeObserver | null = null;
    private assetsUri: string;

    // Pagination state
    private totalLoaded = 0;
    private hasMore = true;
    private isLoading = false;

    // Search state
    private currentSearchQuery = '';

    // Branch color mapping
    private branchColors: Record<string, string> = {};
    private colorPalette = [
        '#00E676', // neon green
        '#FF2A9D', // neon magenta
        '#00D4FF', // bright cyan
        '#FF9100', // neon orange
        '#B724FF', // electric purple
        '#FF3D57', // crimson red
        '#FFD600', // bright yellow
    ];
    private colorIndex = 0;

    // Conventional commit types for badge detection
    private static readonly COMMIT_TYPES: Record<string, { label: string; cssClass: string }> = {
        'feat':     { label: 'feat',     cssClass: 'type-feat' },
        'fix':      { label: 'fix',      cssClass: 'type-fix' },
        'chore':    { label: 'chore',    cssClass: 'type-chore' },
        'docs':     { label: 'docs',     cssClass: 'type-docs' },
        'style':    { label: 'style',    cssClass: 'type-style' },
        'refactor': { label: 'refactor', cssClass: 'type-refactor' },
        'perf':     { label: 'perf',     cssClass: 'type-feat' },
        'test':     { label: 'test',     cssClass: 'type-docs' },
        'ci':       { label: 'ci',       cssClass: 'type-other' },
        'build':    { label: 'build',    cssClass: 'type-other' },
        'revert':   { label: 'revert',   cssClass: 'type-fix' },
        'add':      { label: 'add',      cssClass: 'type-add' },
        'new':      { label: 'new',      cssClass: 'type-add' },
    };

    constructor() {
        // @ts-ignore
        this.vscode = (window as any).vscodeApi;
        this.assetsUri = (window as any).ASSETS_URI || '';
        this.tableBody = document.getElementById('commits-table-body');
        this.overlay = document.getElementById('tree-graph-overlay') as HTMLDivElement;

        this.init();
    }

    private init() {
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'renderCommits' && msg.data) {
                this.onCommitsReceived(msg.data, msg.skip, msg.hasMore);
            }
        });

        // Infinite scroll
        if (this.tableBody) {
            this.tableBody.addEventListener('scroll', () => this.onScroll());
        }

        // Listen for search events from the header SearchBox
        window.addEventListener('commitSearch', ((e: CustomEvent) => {
            this.currentSearchQuery = e.detail.query || '';
            this.filterRows();
        }) as EventListener);
    }

    private onCommitsReceived(commits: CommitRowData[], skip: number, hasMore: boolean) {
        if (!this.tableBody) { return; }

        // First batch: remove skeletons
        if (skip === 0) {
            this.tableBody.innerHTML = '';
        }

        // Remove loading indicator if present
        const loader = this.tableBody.querySelector('.loading-more');
        if (loader) { loader.remove(); }

        // Append rows
        const fragment = document.createDocumentFragment();
        commits.forEach((commit, i) => {
            const row = this.createCommitRow(commit, skip + i);
            fragment.appendChild(row);
        });
        this.tableBody.appendChild(fragment);

        this.totalLoaded = skip + commits.length;
        this.hasMore = hasMore;
        this.isLoading = false;

        // Redraw graph after rows are in DOM
        requestAnimationFrame(() => {
            // Apply search filter if active
            if (this.currentSearchQuery) {
                this.filterRows();
            }
            this.drawTreeGraph();
            if (!this.resizeObserver) {
                this.setupResizeObserver();
            }
        });
    }

    // ── Search Filter ────────────────────────────────────

    private filterRows() {
        if (!this.tableBody) { return; }

        const query = this.currentSearchQuery.toLowerCase();
        const rows = this.tableBody.querySelectorAll('.table-row:not(.skeleton-row)');
        const noResults = document.getElementById('no-results');

        // If query is empty, show all rows and hide message
        if (!query) {
            rows.forEach(row => {
                (row as HTMLElement).style.display = '';
            });
            if (noResults) { noResults.style.display = 'none'; }
            requestAnimationFrame(() => this.drawTreeGraph());
            return;
        }

        // Detect if query looks like a commit hash (hex characters only, ≥7 length)
        const isHashSearch = /^[0-9a-f]{7,}$/i.test(query);
        let visibleCount = 0;

        rows.forEach(row => {
            const el = row as HTMLElement;
            const hash = el.getAttribute('data-hash') || '';

            if (isHashSearch) {
                // Hash search: prefix match on the full hash
                const match = hash.toLowerCase().startsWith(query);
                el.style.display = match ? '' : 'none';
                if (match) { visibleCount++; }
            } else {
                // Text search: match against message, author, branch, date
                const message = el.querySelector('.commit-msg-text')?.textContent?.toLowerCase() || '';
                const typeBadge = el.querySelector('.commit-type-badge')?.textContent?.toLowerCase() || '';
                const author = el.querySelector('.author-name-text')?.textContent?.toLowerCase() || '';
                const branch = el.querySelector('.branch-name')?.textContent?.toLowerCase() || '';
                const date = el.querySelector('.date-text')?.textContent?.toLowerCase() || '';

                const searchable = `${typeBadge} ${message} ${author} ${branch} ${date}`;
                const match = searchable.includes(query);
                el.style.display = match ? '' : 'none';
                if (match) { visibleCount++; }
            }
        });

        // Show/hide no-results message
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? '' : 'none';
        }

        // Redraw graph to account for hidden rows
        requestAnimationFrame(() => this.drawTreeGraph());
    }

    // ── Conventional Commit Detection ────────────────────

    private parseCommitType(message: string): { type: string; cssClass: string; cleanMessage: string } | null {
        // Match patterns like "feat: ...", "fix(scope): ...", "Add ..."
        const conventionalMatch = message.match(/^(\w+)(?:\([^)]*\))?[!]?:\s*(.*)/);
        if (conventionalMatch) {
            const rawType = conventionalMatch[1].toLowerCase();
            const typeInfo = CommitsManager.COMMIT_TYPES[rawType];
            if (typeInfo) {
                return {
                    type: typeInfo.label,
                    cssClass: typeInfo.cssClass,
                    cleanMessage: conventionalMatch[2]
                };
            }
        }
        // Also detect bracket prefixes like "[new]" or "[add]"
        const bracketMatch = message.match(/^\[(\w+)\]\s*(.*)/);
        if (bracketMatch) {
            const rawType = bracketMatch[1].toLowerCase();
            const typeInfo = CommitsManager.COMMIT_TYPES[rawType];
            if (typeInfo) {
                return {
                    type: typeInfo.label,
                    cssClass: typeInfo.cssClass,
                    cleanMessage: bracketMatch[2]
                };
            }
        }
        return null;
    }

    private createCommitRow(commit: CommitRowData, index: number): HTMLElement {
        const row = document.createElement('div');
        row.className = 'table-row' + (commit.isHead ? ' active' : '');
        row.setAttribute('data-hash', commit.hash);

        // Assign a color to this commit's branch
        const color = this.getBranchColor(commit.branch || 'default-lane');

        // 1. Branch column
        const branchCol = document.createElement('div');
        branchCol.className = 'col col-branch';
        if (commit.branch) {
            branchCol.innerHTML = `
                <div class="branch-badge" style="background-color: color-mix(in srgb, ${color} 10%, transparent); border: 1px solid color-mix(in srgb, ${color} 20%, transparent); color: ${color};">
                    <svg class="branch-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="margin-right: 4px;">
                        <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.378a2.25 2.25 0 1 1-1.5 0V5.378a2.25 2.25 0 1 1 1.5 0v1.122A2.5 2.5 0 0 1 7.5 4h2a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z"></path>
                    </svg>
                    <span class="branch-name">${this.escapeHtml(commit.branch)}</span>
                </div>
            `;
        }
        row.appendChild(branchCol);

        // 2. Graph column (placeholder for SVG overlay)
        const graphCol = document.createElement('div');
        graphCol.className = 'col col-graph graph-col node-placeholder';
        graphCol.setAttribute('data-branch', commit.branch || '');
        graphCol.setAttribute('data-color', color);
        row.appendChild(graphCol);

        // 3. Message column — with conventional commit type badge
        const msgCol = document.createElement('div');
        msgCol.className = 'col col-message msg-col';
        msgCol.title = commit.message;

        const parsed = this.parseCommitType(commit.message);
        if (parsed) {
            msgCol.innerHTML = `<span class="commit-type-badge ${parsed.cssClass}">${parsed.type}</span><span class="commit-msg-text">${this.escapeHtml(parsed.cleanMessage)}</span>`;
        } else {
            msgCol.innerHTML = `<span class="commit-msg-text">${this.escapeHtml(commit.message)}</span>`;
        }
        row.appendChild(msgCol);

        // 4. Author column
        const authorCol = document.createElement('div');
        authorCol.className = 'col col-author';
        
        const authorNameDisplay = commit.authorName === ((window as any).__gitUser || '') ? 'You' : commit.authorName;

        authorCol.innerHTML = `
            <div class="author-cell">
                <span class="author-name-text" title="${this.escapeHtml(commit.authorName)}">${this.escapeHtml(authorNameDisplay)}</span>
            </div>
        `;
        row.appendChild(authorCol);

        // 5. Changes column
        const changesCol = document.createElement('div');
        changesCol.className = 'col col-changes';
        changesCol.innerHTML = `<span class="changes-count">
            <div class="icon-mask" style="--icon-size: 12px; -webkit-mask-image: url('${this.assetsUri}/icons/changes.svg'); mask-image: url('${this.assetsUri}/icons/changes.svg');"></div>
            ${commit.filesChanged}
        </span>`;
        row.appendChild(changesCol);

        // 6. Date column
        const dateCol = document.createElement('div');
        dateCol.className = 'col col-date';
        dateCol.innerHTML = `<span class="date-text">${this.escapeHtml(commit.date)}</span>`;
        row.appendChild(dateCol);

        // Click to select commit and show in inspect panel
        row.addEventListener('click', () => {
            // Skip if this commit is already selected
            if (row.classList.contains('active')) { return; }

            // Remove active from all rows
            this.tableBody?.querySelectorAll('.table-row.active').forEach(r => r.classList.remove('active'));
            row.classList.add('active');

            // Notify inspect panel to show loading state immediately (with hash for race-condition guard)
            window.dispatchEvent(new CustomEvent('commitSelected', { detail: { hash: commit.hash } }));

            if (this.vscode) {
                this.vscode.postMessage({ type: 'selectCommit', hash: commit.hash });
            }
        });

        return row;
    }

    // ── Infinite Scroll ──────────────────────────────────

    private onScroll() {
        if (!this.tableBody || this.isLoading || !this.hasMore) { return; }

        const { scrollTop, scrollHeight, clientHeight } = this.tableBody;
        // Load more when user is within 100px of the bottom
        if (scrollHeight - scrollTop - clientHeight < 100) {
            this.loadMore();
        }
    }

    private loadMore() {
        if (this.isLoading || !this.hasMore) { return; }
        this.isLoading = true;

        // Show loading spinner
        if (this.tableBody) {
            const loader = document.createElement('div');
            loader.className = 'loading-more';
            loader.innerHTML = '<div class="loading-spinner"></div>';
            this.tableBody.appendChild(loader);
        }

        if (this.vscode) {
            this.vscode.postMessage({
                type: 'loadMoreCommits',
                skip: this.totalLoaded,
                limit: 25,
            });
        }
    }

    // ── Graph Renderer ───────────────────────────────────

    private setupResizeObserver() {
        if (!this.tableBody) { return; }

        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => this.drawTreeGraph());
        });
        this.resizeObserver.observe(this.tableBody);

        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.drawTreeGraph());
        });

        // Redraw on scroll (because visible rows change position)
        this.tableBody.addEventListener('scroll', () => {
            requestAnimationFrame(() => this.drawTreeGraph());
        });
    }

    private drawTreeGraph() {
        if (!this.overlay) { return; }
        this.overlay.innerHTML = '';

        const svg = document.createElementNS(this.svgNamespace, 'svg') as SVGSVGElement & HTMLElement;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.overflow = 'visible';
        this.overlay.appendChild(svg);

        const overlayRect = this.overlay.getBoundingClientRect();
        const placeholders = document.querySelectorAll('.table-row .node-placeholder');
        const nodes: { x: number; y: number; color: string }[] = [];

        placeholders.forEach((el) => {
            // Skip hidden rows (filtered out by search)
            const row = el.closest('.table-row') as HTMLElement | null;
            if (row && row.style.display === 'none') { return; }

            const rect = el.getBoundingClientRect();
            const x = (rect.left - overlayRect.left) + (rect.width / 2);
            const y = (rect.top - overlayRect.top) + (rect.height / 2);
            const color = el.getAttribute('data-color') || 'var(--accent-blue)';
            nodes.push({ x, y, color });
        });

        if (nodes.length === 0) { return; }

        // Draw connecting paths
        for (let i = 1; i < nodes.length; i++) {
            const curr = nodes[i];
            const prev = nodes[i - 1];
            const d = Math.abs(curr.x - prev.x) < 2
                ? `M ${curr.x} ${curr.y} L ${prev.x} ${prev.y}`
                : `M ${curr.x} ${curr.y} C ${curr.x} ${(curr.y + prev.y) / 2}, ${prev.x} ${(curr.y + prev.y) / 2}, ${prev.x} ${prev.y}`;

            const path = document.createElementNS(this.svgNamespace, 'path') as SVGElement;
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', curr.color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('opacity', '0.75');
            path.style.filter = `drop-shadow(0px 0px 3px ${curr.color})`;
            svg.appendChild(path);
        }

        // Draw commit nodes
        nodes.forEach(node => {
            const shadow = document.createElementNS(this.svgNamespace, 'circle');
            shadow.setAttribute('cx', String(node.x));
            shadow.setAttribute('cy', String(node.y));
            shadow.setAttribute('r', '7');
            shadow.setAttribute('fill', 'var(--bg-base)');
            shadow.setAttribute('opacity', '0.9');
            svg.appendChild(shadow);

            const circle = document.createElementNS(this.svgNamespace, 'circle') as SVGElement;
            circle.setAttribute('cx', String(node.x));
            circle.setAttribute('cy', String(node.y));
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', node.color);
            circle.setAttribute('stroke', 'var(--bg-base)');
            circle.setAttribute('stroke-width', '1.5');
            circle.style.filter = `drop-shadow(0px 0px 4px ${node.color})`;
            svg.appendChild(circle);
        });
    }

    // ── Helpers ───────────────────────────────────────────

    private getBranchColor(branch: string): string {
        if (branch === 'default-lane') {
            return 'var(--accent-blue)';
        }
        if (!this.branchColors[branch]) {
            this.branchColors[branch] = this.colorPalette[this.colorIndex % this.colorPalette.length];
            this.colorIndex++;
        }
        return this.branchColors[branch];
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CommitsManager();
    });
} else {
    new CommitsManager();
}

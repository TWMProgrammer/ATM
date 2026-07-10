/* Git Commands — HTML builder.
 * Pure functions that turn GitCategory/GitCommand data into HTML strings.
 * No VS Code APIs — safe to unit-test in isolation. */

import type { GitCategory, GitCommand } from './types';

/* ------------------------------------------------------------------ */
/* Escaping                                                            */
/* ------------------------------------------------------------------ */

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Inline SVG snippets                                                 */
/* ------------------------------------------------------------------ */

export function copySvg(): string {
	return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/>
		<path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.4"/>
	</svg>`;
}

export function searchEmptySvg(): string {
	return `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="17" cy="17" r="10" stroke="currentColor" stroke-width="2.5"/>
		<path d="M25 25L36 36" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
	</svg>`;
}

export function checkSvg(): string {
	return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M3 8l3.5 3.5L13 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>`;
}

export function gitBrandSvg(): string {
	return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
		<line x1="30" y1="18" x2="30" y2="82" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
		<path d="M30 50 C 46 50, 54 50, 70 50" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
		<circle cx="30" cy="18" r="7" fill="currentColor"/>
		<circle cx="30" cy="82" r="7" fill="currentColor"/>
		<circle cx="70" cy="50" r="7" fill="currentColor"/>
	</svg>`;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function buildCard(cmd: GitCommand): string {
	const safeCmd  = escapeHtml(cmd.command);
	const safeDesc = escapeHtml(cmd.desc);
	return `<div
		class="cmd-card"
		role="button"
		tabindex="0"
		data-command="${safeCmd}"
		data-desc="${safeDesc}"
		aria-label="Copy: ${safeCmd}"
	>
		<span class="cmd-icon" aria-hidden="true">${cmd.icon}</span>
		<div class="cmd-body">
			<span class="cmd-code">${safeCmd}</span>
			<span class="cmd-desc">${safeDesc}</span>
		</div>
		<span class="cmd-copy" aria-hidden="true">${copySvg()}</span>
	</div>`;
}

/* ------------------------------------------------------------------ */
/* Category section                                                    */
/* ------------------------------------------------------------------ */

export function buildCategory(cat: GitCategory): string {
	const cards     = cat.commands.map(buildCard).join('\n');
	const safeColor = escapeHtml(cat.color);
	const safeName  = escapeHtml(cat.name);
	return `<section class="category" style="--cat-color:${safeColor}">
		<div class="category-header">
			<span class="category-dot" style="background:${safeColor}"></span>
			<span class="category-name">${safeName}</span>
			<span class="category-count">${cat.commands.length}</span>
		</div>
		<div class="category-grid">
			${cards}
		</div>
	</section>`;
}

/* ------------------------------------------------------------------ */
/* Page-level blocks                                                   */
/* ------------------------------------------------------------------ */

export function buildCommandsHtml(categories: GitCategory[]): string {
	return categories.map(buildCategory).join('\n');
}

export function buildToastHtml(): string {
	return `<div id="git-toast" class="toast" role="status" aria-live="polite">
		${checkSvg()}
		<span class="toast-msg">Copied!</span>
	</div>`;
}

export function buildNoResultsHtml(): string {
	return `<div id="no-results" class="no-results" role="status">
		${searchEmptySvg()}
		<span>No commands match your search</span>
	</div>`;
}

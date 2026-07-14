/* Git Commands — Webview Client Script
 *
 * Handles search/filter, copy-to-clipboard, keyboard shortcuts,
 * and no-results state. All DOM work happens here; no dependencies. */

interface VsCodeApi {
	postMessage(msg: unknown): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

const vscodeApi = acquireVsCodeApi();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function $(sel: string): HTMLElement | null {
	return document.querySelector(sel) as HTMLElement | null;
}
function $all(sel: string): HTMLElement[] {
	return Array.from(document.querySelectorAll(sel)) as HTMLElement[];
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

let toastTimer = 0;

function showToast(text: string): void {
	const toast = $('#git-toast');
	if (!toast) { return; }
	const msg = toast.querySelector('.toast-msg');
	if (msg) { msg.textContent = text; }
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function copyCommand(card: HTMLElement): void {
	const code = card.dataset.command;
	if (!code) { return; }

	navigator.clipboard.writeText(code).then(() => {
		card.classList.add('copied');
		setTimeout(() => card.classList.remove('copied'), 1800);
		showToast(`Copied: ${code}`);
		vscodeApi.postMessage({ type: 'copy', command: code });
	}).catch(() => {
		// Fallback for environments without clipboard API
		const ta = document.createElement('textarea');
		ta.value = code;
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		document.execCommand('copy');
		document.body.removeChild(ta);
		card.classList.add('copied');
		setTimeout(() => card.classList.remove('copied'), 1800);
		showToast(`Copied: ${code}`);
	});
}

/* ------------------------------------------------------------------ */
/* Search / filter                                                     */
/* ------------------------------------------------------------------ */

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(el: Element, query: string): void {
	const plain = el.getAttribute('data-plain') ?? el.textContent ?? '';
	if (!el.getAttribute('data-plain')) {
		el.setAttribute('data-plain', plain);
	}
	if (!query) {
		el.innerHTML = plain;
		return;
	}
	const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
	el.innerHTML = plain.replace(re, '<mark>$1</mark>');
}

function filterCommands(query: string): void {
	const q = query.trim().toLowerCase();
	const categories = $all('.category');
	let anyVisible = false;

	for (const cat of categories) {
		const cards = Array.from(cat.querySelectorAll('.cmd-card')) as HTMLElement[];
		let catVisible = false;

		for (const card of cards) {
			const cmd  = (card.dataset.command  ?? '').toLowerCase();
			const desc = (card.dataset.desc     ?? '').toLowerCase();
			const match = !q || cmd.includes(q) || desc.includes(q);

			card.dataset.hidden = match ? 'false' : 'true';
			if (match) {
				catVisible = true;
				anyVisible = true;
				highlightText(card.querySelector('.cmd-code')!, q);
				highlightText(card.querySelector('.cmd-desc')!, q);
			}
		}

		cat.dataset.hidden = catVisible ? 'false' : 'true';
	}

	const noResults = $('#no-results');
	if (noResults) {
		noResults.classList.toggle('show', !anyVisible && q.length > 0);
	}
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

// Search input
const searchInput = $('#git-search') as HTMLInputElement | null;
if (searchInput) {
	searchInput.addEventListener('input', () => filterCommands(searchInput.value));

	// clear on Escape
	searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			searchInput.value = '';
			filterCommands('');
			searchInput.blur();
		}
	});
}

// Keyboard shortcut "/" to focus search
document.addEventListener('keydown', (e: KeyboardEvent) => {
	const tag = (e.target as HTMLElement).tagName;
	if (e.key === '/' && tag !== 'INPUT') {
		e.preventDefault();
		searchInput?.focus();
	}
});

// Copy on card click
document.addEventListener('click', (e: MouseEvent) => {
	const card = (e.target as HTMLElement).closest<HTMLElement>('.cmd-card');
	if (card) {
		copyCommand(card);
	}
});

// Keyboard copy (Enter / Space on focused card)
document.addEventListener('keydown', (e: KeyboardEvent) => {
	if (e.key !== 'Enter' && e.key !== ' ') { return; }
	const card = (e.target as HTMLElement).closest<HTMLElement>('.cmd-card');
	if (card) {
		e.preventDefault();
		copyCommand(card);
	}
});

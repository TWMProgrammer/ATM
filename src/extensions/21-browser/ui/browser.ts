import { quickUrls, resolveNavigationTarget } from '../core/navigation';

const homeForm         = document.querySelector<HTMLFormElement>('#browser-search-form');
const homeInput        = document.querySelector<HTMLInputElement>('#browser-search-input');
const toolbarForm      = document.querySelector<HTMLFormElement>('#browser-toolbar-form');
const toolbarInput     = document.querySelector<HTMLInputElement>('#browser-toolbar-input');
const homeButton       = document.querySelector<HTMLButtonElement>('#home-action');
const backButton       = document.querySelector<HTMLButtonElement>('#back-action');
const forwardButton    = document.querySelector<HTMLButtonElement>('#forward-action');
const reloadButton     = document.querySelector<HTMLButtonElement>('#reload-action');
const openExternalBtn  = document.querySelector<HTMLButtonElement>('#open-external-action');
const translateButton  = document.querySelector<HTMLButtonElement>('#translate-action');
const mdnButton        = document.querySelector<HTMLButtonElement>('#mdn-action');
const chatgptButton    = document.querySelector<HTMLButtonElement>('#chatgpt-action');
const browserFrame     = document.querySelector<HTMLIFrameElement>('#browser-frame');
const frameLoading     = document.querySelector<HTMLDivElement>('#frame-loading');
const frameError       = document.querySelector<HTMLDivElement>('#frame-error');
const errorExternalBtn = document.querySelector<HTMLButtonElement>('#frame-error-external');

declare const acquireVsCodeApi: () => { postMessage(msg: unknown): void };
const vscodeApi = (typeof acquireVsCodeApi !== 'undefined') ? acquireVsCodeApi() : null;

let currentUrl = '';
let loadTimeout: ReturnType<typeof setTimeout> | null = null;

const navHistory: string[] = [];
let navIndex = -1;
let navigatingInHistory = false;

homeForm?.addEventListener('submit', (e) => {
	e.preventDefault();
	navigateTo(resolveNavigationTarget(homeInput?.value ?? ''));
});

toolbarForm?.addEventListener('submit', (e) => {
	e.preventDefault();
	navigateTo(resolveNavigationTarget(toolbarInput?.value ?? ''));
});

translateButton?.addEventListener('click', () => navigateTo(quickUrls.translate));
mdnButton?.addEventListener('click',       () => navigateTo(quickUrls.mdn));
chatgptButton?.addEventListener('click',   () => navigateTo(quickUrls.chatgpt));
homeButton?.addEventListener('click',      () => showHome());
backButton?.addEventListener('click',      () => goBack());
forwardButton?.addEventListener('click',   () => goForward());
reloadButton?.addEventListener('click',    () => reloadFrame());

openExternalBtn?.addEventListener('click', () => openExternal(currentUrl));
errorExternalBtn?.addEventListener('click', () => openExternal(currentUrl));

browserFrame?.addEventListener('load', () => {
	hideLoading();

	setTimeout(() => {
		if (!document.body.classList.contains('is-browsing')) { return; }
		if (isFrameBlocked()) {
			showError();
		} else {
			hideError();
		}
		updateNavButtons();
	}, 80);
});

browserFrame?.addEventListener('error', () => {
	hideLoading();
	showError();
});

function isFrameBlocked(): boolean {
	if (!browserFrame) { return true; }

	if (!browserFrame.contentWindow) { return true; }

	try {
		const doc = browserFrame.contentDocument;
		if (!doc) { return true; }

		if (!doc.body || (doc.body.children.length === 0 && !doc.body.innerText?.trim())) {
			return !!(browserFrame.src && !browserFrame.src.startsWith('about:'));
		}

		return false;
	} catch {
		return false;
	}
}

function navigateTo(url: string): void {
	if (!url || !browserFrame) { return; }

	currentUrl = url;
	document.body.classList.add('is-browsing');

	if (!navigatingInHistory) {
		if (navIndex < navHistory.length - 1) {
			navHistory.length = navIndex + 1;
		}
		navHistory.push(url);
		navIndex = navHistory.length - 1;
	}
	navigatingInHistory = false;

	browserFrame.src = url;

	setInputs(url);
	showLoading();
	hideError();

	updateNavButtons();

	if (loadTimeout) { clearTimeout(loadTimeout); }
	loadTimeout = setTimeout(() => {
		if (frameLoading && !frameLoading.hidden) {
			hideLoading();
			showError();
		}
	}, 20_000);
}

function goBack(): void {
	if (navIndex <= 0 || !browserFrame) { return; }
	navIndex--;
	navigatingInHistory = true;
	const url = navHistory[navIndex];
	currentUrl = url;
	setInputs(url);
	showLoading();
	hideError();
	browserFrame.src = url;
	updateNavButtons();
}

function goForward(): void {
	if (navIndex >= navHistory.length - 1 || !browserFrame) { return; }
	navIndex++;
	navigatingInHistory = true;
	const url = navHistory[navIndex];
	currentUrl = url;
	setInputs(url);
	showLoading();
	hideError();
	browserFrame.src = url;
	updateNavButtons();
}

function updateNavButtons(): void {
	if (backButton) {
		backButton.disabled = navIndex <= 0;
	}
	if (forwardButton) {
		forwardButton.disabled = navIndex >= navHistory.length - 1;
	}
}

function showHome(): void {
	document.body.classList.remove('is-browsing');

	if (browserFrame) {
		browserFrame.removeAttribute('src');
	}

	setInputs('');
	hideLoading();
	hideError();
	currentUrl = '';
	navHistory.length = 0;
	navIndex = -1;
	updateNavButtons();

	homeInput?.focus();
}

function reloadFrame(): void {
	if (!browserFrame || !currentUrl) { return; }
	showLoading();
	hideError();
	browserFrame.src = currentUrl;
}

function openExternal(url: string): void {
	if (!url) { return; }
	vscodeApi?.postMessage({ type: 'openExternal', url });
}

function setInputs(url: string): void {
	if (homeInput)    { homeInput.value    = url; }
	if (toolbarInput) { toolbarInput.value = url; }
}

function showLoading(): void {
	if (frameLoading) { frameLoading.hidden = false; }
	hideError();
}

function hideLoading(): void {
	if (frameLoading) { frameLoading.hidden = true; }
	if (loadTimeout)  { clearTimeout(loadTimeout); loadTimeout = null; }
}

function showError(): void {
	if (frameError) { frameError.hidden = false; }
}

function hideError(): void {
	if (frameError) { frameError.hidden = true; }
}

window.addEventListener('message', (event: MessageEvent) => {
	if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
		navigateTo(resolveNavigationTarget(event.data.url));
	}
});

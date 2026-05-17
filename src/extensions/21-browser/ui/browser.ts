import { quickUrls, resolveNavigationTarget } from '../core/navigation';

const homeForm = document.querySelector<HTMLFormElement>('#browser-search-form');
const homeInput = document.querySelector<HTMLInputElement>('#browser-search-input');
const toolbarForm = document.querySelector<HTMLFormElement>('#browser-toolbar-form');
const toolbarInput = document.querySelector<HTMLInputElement>('#browser-toolbar-input');
const homeButton = document.querySelector<HTMLButtonElement>('#home-action');
const translateButton = document.querySelector<HTMLButtonElement>('#translate-action');
const browserFrame = document.querySelector<HTMLIFrameElement>('#browser-frame');

homeForm?.addEventListener('submit', (event) => {
	event.preventDefault();

	navigateTo(resolveNavigationTarget(homeInput?.value ?? ''));
});

toolbarForm?.addEventListener('submit', (event) => {
	event.preventDefault();

	navigateTo(resolveNavigationTarget(toolbarInput?.value ?? ''));
});

translateButton?.addEventListener('click', () => {
	navigateTo(quickUrls.translate);
});

homeButton?.addEventListener('click', () => {
	showHome();
});

function navigateTo(url: string): void {
	if (!url || !browserFrame) { return; }

	document.body.classList.add('is-browsing');
	browserFrame.src = url;

	if (homeInput) {
		homeInput.value = url;
	}

	if (toolbarInput) {
		toolbarInput.value = url;
	}
}

function showHome(): void {
	document.body.classList.remove('is-browsing');

	if (browserFrame) {
		browserFrame.removeAttribute('src');
	}

	if (toolbarInput) {
		toolbarInput.value = '';
	}

	if (homeInput) {
		homeInput.value = '';
		homeInput.focus();
	}
}

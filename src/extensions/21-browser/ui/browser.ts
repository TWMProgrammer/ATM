import { quickUrls, resolveNavigationTarget } from '../core/navigation';

const homeForm = document.querySelector<HTMLFormElement>('#browser-search-form');
const homeInput = document.querySelector<HTMLInputElement>('#browser-search-input');
const toolbarForm = document.querySelector<HTMLFormElement>('#browser-toolbar-form');
const toolbarInput = document.querySelector<HTMLInputElement>('#browser-toolbar-input');
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

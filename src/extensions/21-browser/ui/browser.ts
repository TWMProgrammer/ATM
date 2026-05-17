import { languages, getLanguageName, getLanguageFlag } from './flags';

interface VsCodeApi {
	postMessage(msg: unknown): void;
	setState(state: unknown): void;
	getState(): unknown;
}

interface PersistedState {
	sourceText?: string;
	translatedText?: string;
	sourceLanguage?: string;
	targetLanguage?: string;
	autoTranslate?: boolean;
}

declare const acquireVsCodeApi: () => VsCodeApi;

const vscodeApi = acquireVsCodeApi();

const sourceLanguage = document.querySelector<HTMLSelectElement>('#source-language')!;
const targetLanguage = document.querySelector<HTMLSelectElement>('#target-language')!;
const sourceLabel = document.querySelector<HTMLElement>('#source-label')!;
const targetLabel = document.querySelector<HTMLElement>('#target-label')!;
const sourceText = document.querySelector<HTMLTextAreaElement>('#source-text')!;
const sourceCount = document.querySelector<HTMLElement>('#source-count')!;
const translatedOutput = document.querySelector<HTMLElement>('#translation-output')!;
const statusText = document.querySelector<HTMLElement>('#status-text')!;
const translateAction = document.querySelector<HTMLButtonElement>('#translate-action')!;
const translateLabel = document.querySelector<HTMLElement>('#translate-label')!;
const clearAction = document.querySelector<HTMLButtonElement>('#clear-action')!;
const copyAction = document.querySelector<HTMLButtonElement>('#copy-action')!;
const swapAction = document.querySelector<HTMLButtonElement>('#swap-action')!;
const buttonSpinner = document.querySelector<HTMLElement>('#button-spinner')!;
const outputCard = document.querySelector<HTMLElement>('.output-card')!;
const spellcheckAction = document.querySelector<HTMLButtonElement>('#spellcheck-action')!;
const autoTranslateCheck = document.querySelector<HTMLInputElement>('#auto-translate-check')!;

const CHAR_LIMIT = 5000;
const DEBOUNCE_MS = 500;

let activeRequestId = '';
let translatedText = '';
let debounceTimer: number | undefined;
let lastRenderedText = '';
let autoTranslate = true;

init();

function init(): void {
	populateLanguageSelects();
	restoreState();
	updateAutoToggle();
	wireEvents();
	updateLabels();
	updateCount();
	if (translatedText) {
		renderOutput(translatedText);
	}
	sourceText.focus();
}

function populateLanguageSelects(): void {
	for (const lang of languages) {
		sourceLanguage.append(createOption(lang));

		if (lang.code !== 'auto') {
			targetLanguage.append(createOption(lang));
		}
	}

	sourceLanguage.value = 'auto';
	targetLanguage.value = 'es';
}

function createOption(lang: typeof languages[number]): HTMLOptionElement {
	const option = document.createElement('option');
	option.value = lang.code;
	option.textContent = `${lang.flag}\u00A0\u00A0\u00A0${lang.name}`;
	return option;
}

function restoreState(): void {
	const state = vscodeApi.getState() as PersistedState | undefined;
	if (!state) { return; }

	if (state.sourceLanguage) { sourceLanguage.value = state.sourceLanguage; }
	if (state.targetLanguage) { targetLanguage.value = state.targetLanguage; }
	if (state.sourceText) { sourceText.value = state.sourceText; }
	if (state.translatedText) { translatedText = state.translatedText; }
	if (typeof state.autoTranslate === 'boolean') { autoTranslate = state.autoTranslate; }
}

function updateAutoToggle(): void {
	autoTranslateCheck.checked = autoTranslate;
	updateTranslateButton();
}

function updateTranslateButton(): void {
	if (autoTranslate) {
		translateAction.classList.add('primary-button--manual');
		translateLabel.textContent = 'Automatic';
	} else {
		translateAction.classList.remove('primary-button--manual');
		translateLabel.textContent = 'Translate';
	}
}

function wireEvents(): void {
	translateAction.addEventListener('click', () => {
		if (!autoTranslate) {
			doTranslate();
		}
	});

	autoTranslateCheck.addEventListener('change', () => {
		autoTranslate = autoTranslateCheck.checked;
		updateTranslateButton();
		persistState();

		if (autoTranslate && sourceText.value.trim().length >= 2) {
			doTranslate();
		}
	});

	sourceText.addEventListener('input', () => {
		updateCount();
		persistState();

		window.clearTimeout(debounceTimer);

		if (sourceText.value.trim().length < 2) {
			translatedText = '';
			lastRenderedText = '';
			renderOutput('');
			setStatus('Ready');
			return;
		}

		if (autoTranslate) {
			debounceTimer = window.setTimeout(doTranslate, DEBOUNCE_MS);
		}
	});

	sourceText.addEventListener('keydown', (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			window.clearTimeout(debounceTimer);
			doTranslate();
		}
	});

	sourceLanguage.addEventListener('change', () => {
		updateLabels();
		persistState();
		doTranslate();
	});

	targetLanguage.addEventListener('change', () => {
		updateLabels();
		persistState();
		doTranslate();
	});

	clearAction.addEventListener('click', () => {
		sourceText.value = '';
		translatedText = '';
		lastRenderedText = '';
		updateCount();
		renderOutput('');
		setStatus('Ready');
		persistState();
		sourceText.focus();
	});

	spellcheckAction.addEventListener('click', () => {
		const text = sourceText.value.trim();
		if (!text) { return; }

		spellcheckAction.classList.add('loading');
		spellcheckAction.disabled = true;
		setStatus('Correcting spelling...');

		vscodeApi.postMessage({
			type: 'spellcheck',
			text,
			language: sourceLanguage.value === 'auto' ? targetLanguage.value : sourceLanguage.value,
		});
	});

	copyAction.addEventListener('click', () => {
		if (!translatedText) { return; }

		vscodeApi.postMessage({ type: 'copy', text: translatedText });
		copyAction.classList.add('copied');
		setStatus('Copied');
		setTimeout(() => copyAction.classList.remove('copied'), 500);
	});

	swapAction.addEventListener('click', () => {
		if (sourceLanguage.value === 'auto') {
			sourceLanguage.value = targetLanguage.value;
		} else {
			const prev = sourceLanguage.value;
			sourceLanguage.value = targetLanguage.value;
			targetLanguage.value = prev;
		}

		if (translatedText) {
			const prevText = sourceText.value;
			sourceText.value = translatedText;
			translatedText = prevText;
			lastRenderedText = translatedText;
			renderOutput(translatedText);
			updateCount();
		}

		updateLabels();
		persistState();
		doTranslate();
	});

	window.addEventListener('message', (event: MessageEvent) => {
		const msg = event.data;

		if (msg?.type === 'setText' && typeof msg.text === 'string') {
			sourceText.value = msg.text;
			updateCount();
			persistState();
			doTranslate();
			sourceText.focus();
			return;
		}

		if (msg?.type === 'translated' && msg.id === activeRequestId) {
			translatedText = msg.text ?? '';
			renderOutput(translatedText);
			setLoading(false);
			setStatus(translatedText ? 'Translated' : 'Ready');
			persistState();
			return;
		}

		if (msg?.type === 'translationError' && msg.id === activeRequestId) {
			setLoading(false);
			setStatus(msg.message || 'Translation failed');
			return;
		}

		if (msg?.type === 'spellcheckResult') {
			spellcheckAction.classList.remove('loading');
			spellcheckAction.disabled = false;

			if (msg.text && typeof msg.text === 'string') {
				sourceText.value = msg.text;
				updateCount();
				persistState();
				setStatus('Spelling corrected');
				if (autoTranslate) {
					doTranslate();
				}
			} else {
				setStatus(msg.error || 'Spell check failed');
			}
			return;
		}
	});
}

function doTranslate(): void {
	const text = sourceText.value.trim();
	if (!text) {
		translatedText = '';
		lastRenderedText = '';
		renderOutput('');
		setStatus('Ready');
		return;
	}

	if (sourceLanguage.value === targetLanguage.value) {
		translatedText = text;
		renderOutput(translatedText);
		setStatus('Same language');
		persistState();
		return;
	}

	activeRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	setLoading(true);
	setStatus('Translating');
	showSkeleton();

	vscodeApi.postMessage({
		type: 'translate',
		id: activeRequestId,
		text,
		from: sourceLanguage.value,
		to: targetLanguage.value,
	});
}

function updateLabels(): void {
	const srcCode = sourceLanguage.value;
	const tgtCode = targetLanguage.value;
	const srcFlag = getLanguageFlag(srcCode);
	const tgtFlag = getLanguageFlag(tgtCode);

	sourceLabel.textContent = `${srcFlag} ${getLanguageName(srcCode)}`;
	targetLabel.textContent = `${tgtFlag} ${getLanguageName(tgtCode)}`;
}

function updateCount(): void {
	const count = sourceText.value.length;
	sourceCount.textContent = `${count} / ${CHAR_LIMIT}`;
	sourceCount.classList.toggle('is-over-limit', count > CHAR_LIMIT);
}

function renderOutput(text: string): void {
	if (text === lastRenderedText) { return; }
	lastRenderedText = text;

	copyAction.disabled = !text;
	outputCard.classList.toggle('has-content', !!text);

	if (!text) {
		translatedOutput.innerHTML = '<span class="empty-state">Translation will appear here</span>';
		return;
	}

	translatedOutput.textContent = text;
}

function showSkeleton(): void {
	if (translatedOutput.querySelector('.skeleton-line')) { return; }
	outputCard.classList.remove('has-content');
	translatedOutput.innerHTML = `
		<div class="skeleton-line" style="width:85%"></div>
		<div class="skeleton-line" style="width:70%"></div>
		<div class="skeleton-line" style="width:55%"></div>
	`;
}

function setStatus(message: string): void {
	statusText.textContent = message;
}

function setLoading(isLoading: boolean): void {
	translateAction.disabled = isLoading;
	sourceLanguage.disabled = isLoading;
	targetLanguage.disabled = isLoading;
	buttonSpinner.hidden = !isLoading;

	if (isLoading) {
		translateLabel.textContent = 'Working';
	} else {
		updateTranslateButton();
	}
}

function persistState(): void {
	vscodeApi.setState({
		sourceText: sourceText.value,
		translatedText,
		sourceLanguage: sourceLanguage.value,
		targetLanguage: targetLanguage.value,
		autoTranslate,
	} satisfies PersistedState);
}

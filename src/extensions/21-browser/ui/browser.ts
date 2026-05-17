interface VsCodeApi {
	postMessage(msg: unknown): void;
	setState(state: unknown): void;
	getState(): unknown;
}

interface Language {
	code: string;
	name: string;
}

interface PersistedState {
	sourceText?: string;
	translatedText?: string;
	sourceLanguage?: string;
	targetLanguage?: string;
}

declare const acquireVsCodeApi: () => VsCodeApi;

const vscodeApi = acquireVsCodeApi();

const languages: Language[] = [
	{ code: 'auto', name: 'Auto detect' },
	{ code: 'en', name: 'English' },
	{ code: 'es', name: 'Spanish' },
	{ code: 'fr', name: 'French' },
	{ code: 'de', name: 'German' },
	{ code: 'it', name: 'Italian' },
	{ code: 'pt', name: 'Portuguese' },
	{ code: 'ja', name: 'Japanese' },
	{ code: 'ko', name: 'Korean' },
	{ code: 'zh-CN', name: 'Chinese' },
	{ code: 'hi', name: 'Hindi' },
	{ code: 'ar', name: 'Arabic' },
	{ code: 'ru', name: 'Russian' },
	{ code: 'vi', name: 'Vietnamese' },
];

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

let activeRequestId = '';
let translatedText = '';
let debounceTimer: number | undefined;

init();

function init(): void {
	populateLanguageSelects();
	restoreState();
	wireEvents();
	updateLabels();
	updateCount();
	updateOutput(translatedText);
	sourceText.focus();
}

function populateLanguageSelects(): void {
	for (const language of languages) {
		sourceLanguage.append(createLanguageOption(language));

		if (language.code !== 'auto') {
			targetLanguage.append(createLanguageOption(language));
		}
	}

	sourceLanguage.value = 'auto';
	targetLanguage.value = 'es';
}

function createLanguageOption(language: Language): HTMLOptionElement {
	const option = document.createElement('option');
	option.value = language.code;
	option.textContent = language.name;
	return option;
}

function restoreState(): void {
	const state = vscodeApi.getState() as PersistedState | undefined;
	if (!state) { return; }

	if (state.sourceLanguage) { sourceLanguage.value = state.sourceLanguage; }
	if (state.targetLanguage) { targetLanguage.value = state.targetLanguage; }
	if (state.sourceText) { sourceText.value = state.sourceText; }
	if (state.translatedText) { translatedText = state.translatedText; }
}

function wireEvents(): void {
	translateAction.addEventListener('click', () => requestTranslation());

	sourceText.addEventListener('input', () => {
		updateCount();
		persistState();

		if (sourceText.value.trim().length < 2) {
			translatedText = '';
			updateOutput('');
			setStatus('Ready');
			return;
		}

		window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => requestTranslation(), 650);
	});

	sourceLanguage.addEventListener('change', () => {
		updateLabels();
		persistState();
		requestTranslation();
	});

	targetLanguage.addEventListener('change', () => {
		updateLabels();
		persistState();
		requestTranslation();
	});

	clearAction.addEventListener('click', () => {
		sourceText.value = '';
		translatedText = '';
		updateCount();
		updateOutput('');
		setStatus('Ready');
		persistState();
		sourceText.focus();
	});

	copyAction.addEventListener('click', () => {
		if (!translatedText) { return; }

		vscodeApi.postMessage({ type: 'copy', text: translatedText });
		setStatus('Copied');
	});

	swapAction.addEventListener('click', () => {
		if (sourceLanguage.value === 'auto') {
			sourceLanguage.value = targetLanguage.value;
		} else {
			const previousSource = sourceLanguage.value;
			sourceLanguage.value = targetLanguage.value;
			targetLanguage.value = previousSource;
		}

		if (translatedText) {
			const previousSourceText = sourceText.value;
			sourceText.value = translatedText;
			translatedText = previousSourceText;
			updateOutput(translatedText);
			updateCount();
		}

		updateLabels();
		persistState();
		requestTranslation();
	});

	window.addEventListener('message', (event: MessageEvent) => {
		const message = event.data;

		if (message?.type === 'setText' && typeof message.text === 'string') {
			sourceText.value = message.text;
			updateCount();
			persistState();
			requestTranslation();
			sourceText.focus();
			return;
		}

		if (message?.type === 'translated' && message.id === activeRequestId) {
			translatedText = message.text ?? '';
			updateOutput(translatedText);
			setLoading(false);
			setStatus(translatedText ? 'Translated' : 'Ready');
			persistState();
			return;
		}

		if (message?.type === 'translationError' && message.id === activeRequestId) {
			setLoading(false);
			setStatus(message.message || 'Translation failed');
		}
	});
}

function requestTranslation(): void {
	const text = sourceText.value.trim();
	if (!text) {
		translatedText = '';
		updateOutput('');
		setStatus('Ready');
		return;
	}

	if (sourceLanguage.value === targetLanguage.value) {
		translatedText = text;
		updateOutput(translatedText);
		setStatus('Same language');
		persistState();
		return;
	}

	activeRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	setLoading(true);
	setStatus('Translating...');

	vscodeApi.postMessage({
		type: 'translate',
		id: activeRequestId,
		text,
		from: sourceLanguage.value,
		to: targetLanguage.value,
	});
}

function updateLabels(): void {
	sourceLabel.textContent = getLanguageName(sourceLanguage.value);
	targetLabel.textContent = getLanguageName(targetLanguage.value);
}

function updateCount(): void {
	const count = sourceText.value.length;
	sourceCount.textContent = `${count} / 5000`;
	sourceCount.classList.toggle('is-over-limit', count > 5000);
}

function updateOutput(text: string): void {
	copyAction.disabled = !text;

	if (!text) {
		translatedOutput.innerHTML = '<span class="empty-state">Your translation will appear here.</span>';
		return;
	}

	translatedOutput.textContent = text;
}

function setStatus(message: string): void {
	statusText.textContent = message;
}

function setLoading(isLoading: boolean): void {
	translateAction.disabled = isLoading;
	sourceLanguage.disabled = isLoading;
	targetLanguage.disabled = isLoading;
	buttonSpinner.hidden = !isLoading;
	translateLabel.textContent = isLoading ? 'Working' : 'Translate';
}

function getLanguageName(code: string): string {
	return languages.find((language) => language.code === code)?.name ?? code;
}

function persistState(): void {
	vscodeApi.setState({
		sourceText: sourceText.value,
		translatedText,
		sourceLanguage: sourceLanguage.value,
		targetLanguage: targetLanguage.value,
	} satisfies PersistedState);
}

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
	imageAttachments?: ImageAttachment[];
	nextImageAttachmentId?: number;
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
const sourceTextWrap = document.querySelector<HTMLElement>('#source-text-wrap')!;
const sourceHighlight = document.querySelector<HTMLElement>('#source-highlight')!;
const autoTranslateCheck = document.querySelector<HTMLInputElement>('#auto-translate-check')!;

const CHAR_LIMIT = 5000;
const DEBOUNCE_MS = 500;

interface TranslateOptions {
	softLoading?: boolean;
}

interface ImageAttachment {
	id: number;
	marker: string;
	source: 'path' | 'clipboard';
	path?: string;
	dataUrl?: string;
	type?: string;
	name?: string;
}

interface ProtectedImageMarker {
	marker: string;
	placeholder: string;
}

let activeRequestId = '';
let activeRequestKey = '';
let lastCompletedRequestKey = '';
let translatedText = '';
let debounceTimer: number | undefined;
let lastRenderedText = '';
let autoTranslate = false;
let imageAttachments: ImageAttachment[] = [];
let nextImageAttachmentId = 1;
let activeTranslationMarkers: ProtectedImageMarker[] = [];
let activeSpellcheckMarkers: ProtectedImageMarker[] = [];

const imagePathPattern =
	/(?:"([^"\r\n]+\.(?:png|jpe?g|gif|webp|bmp|svg|tiff?))"|'([^'\r\n]+\.(?:png|jpe?g|gif|webp|bmp|svg|tiff?))'|((?:~|\/)[^\r\n\t"'<>]*?\.(?:png|jpe?g|gif|webp|bmp|svg|tiff?)))/gi;
const imageMarkerPattern = /\[Image #(\d+)\]/g;

init();

function init(): void {
	populateLanguageSelects();
	restoreState();
	updateAutoToggle();
	wireEvents();
	updateLabels();
	updateCount();
	updateSourceHighlight();
	if (translatedText) {
		renderOutput(translatedText);
	} else {
		renderOutput('');
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
	targetLanguage.value = 'en';
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

	if (state.sourceLanguage && hasOptionValue(sourceLanguage, state.sourceLanguage)) {
		sourceLanguage.value = state.sourceLanguage;
	}
	if (state.targetLanguage && hasOptionValue(targetLanguage, state.targetLanguage)) {
		targetLanguage.value = state.targetLanguage;
	}
	if (state.sourceText) { sourceText.value = state.sourceText; }
	if (state.translatedText) { translatedText = state.translatedText; }
	if (typeof state.autoTranslate === 'boolean') { autoTranslate = state.autoTranslate; }
	if (Array.isArray(state.imageAttachments)) {
		imageAttachments = state.imageAttachments.filter(isImageAttachment);
	}
	if (typeof state.nextImageAttachmentId === 'number' && state.nextImageAttachmentId > 0) {
		nextImageAttachmentId = state.nextImageAttachmentId;
	} else {
		nextImageAttachmentId = getNextImageAttachmentId();
	}
}

function hasOptionValue(select: HTMLSelectElement, value: string): boolean {
	return Array.from(select.options).some((option) => option.value === value);
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
		normalizeSourceInputCasing();
		updateCount();
		updateSourceHighlight();
		persistState();

		window.clearTimeout(debounceTimer);

		if (sourceText.value.trim().length < 2) {
			translatedText = '';
			lastRenderedText = '';
			activeRequestId = '';
			activeRequestKey = '';
			lastCompletedRequestKey = '';
			setLoading(false);
			renderOutput('');
			setStatus('Ready');
			return;
		}

		if (autoTranslate) {
			debounceTimer = window.setTimeout(doTranslate, DEBOUNCE_MS);
		}
	});

	sourceText.addEventListener('paste', (event: ClipboardEvent) => {
		handleSourcePaste(event);
	});

	sourceText.addEventListener('scroll', () => {
		syncSourceHighlightScroll();
	});

	sourceText.addEventListener('keydown', (event: KeyboardEvent) => {
		if (handleImageMarkerDeleteKey(event)) {
			return;
		}

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
		activeRequestId = '';
		activeRequestKey = '';
		lastCompletedRequestKey = '';
		imageAttachments = [];
		nextImageAttachmentId = 1;
		activeTranslationMarkers = [];
		activeSpellcheckMarkers = [];
		setLoading(false);
		updateCount();
		updateSourceHighlight();
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
		sourceTextWrap.classList.add('is-correcting');
		setStatus('Correcting spelling...');

		const protectedText = protectImageMarkers(text);
		activeSpellcheckMarkers = protectedText.markers;

		vscodeApi.postMessage({
			type: 'spellcheck',
			text: protectedText.text,
			language: sourceLanguage.value,
		});
	});

	copyAction.addEventListener('click', () => {
		if (!translatedText) { return; }

		vscodeApi.postMessage({ type: 'copy', text: translatedText });
		copyAction.classList.add('copied');
		setStatus('Copied');
		setTimeout(() => copyAction.classList.remove('copied'), 2000);
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
			normalizeSourceInputCasing();
			translatedText = prevText;
			lastRenderedText = translatedText;
			renderOutput(translatedText);
			updateCount();
			updateSourceHighlight();
		}

		updateLabels();
		persistState();
		doTranslate();
	});

	window.addEventListener('message', (event: MessageEvent) => {
		const msg = event.data;

		if (msg?.type === 'setText' && typeof msg.text === 'string') {
			sourceText.value = replaceImagePathsWithMarkers(msg.text);
			normalizeSourceInputCasing();
			updateCount();
			updateSourceHighlight();
			persistState();
			doTranslate();
			sourceText.focus();
			return;
		}

		if (msg?.type === 'translated' && msg.id === activeRequestId) {
			translatedText = restoreImageMarkers(msg.text ?? '', activeTranslationMarkers);
			lastCompletedRequestKey = activeRequestKey;
			renderOutput(translatedText);
			setLoading(false);
			setOutputSoftLoading(false);
			setStatus(translatedText ? buildProviderStatus('Translated', msg.provider, msg.fromCache) : 'Ready');
			persistState();
			return;
		}

		if (msg?.type === 'translationError' && msg.id === activeRequestId) {
			setLoading(false);
			setOutputSoftLoading(false);
			setStatus(msg.message || 'Translation failed');
			return;
		}

		if (msg?.type === 'spellcheckResult') {
			spellcheckAction.classList.remove('loading');
			spellcheckAction.disabled = false;
			sourceTextWrap.classList.remove('is-correcting');

			if (msg.text && typeof msg.text === 'string') {
				sourceText.value = restoreImageMarkers(msg.text, activeSpellcheckMarkers);
				normalizeSourceInputCasing();
				updateCount();
				updateSourceHighlight();
				persistState();
				setStatus(buildProviderStatus('Spelling corrected', msg.provider, msg.fromCache));
				if (autoTranslate) {
					doTranslate({ softLoading: true });
				}
			} else {
				setStatus(msg.error || 'Spell check failed');
			}
			return;
		}
	});
}

function doTranslate(options: TranslateOptions = {}): void {
	const text = sourceText.value.trim();
	if (!text) {
		translatedText = '';
		lastRenderedText = '';
		activeRequestId = '';
		activeRequestKey = '';
		lastCompletedRequestKey = '';
		setLoading(false);
		setOutputSoftLoading(false);
		renderOutput('');
		setStatus('Ready');
		return;
	}

	if (text.length > CHAR_LIMIT) {
		setLoading(false);
		setOutputSoftLoading(false);
		setStatus(`Text is over ${CHAR_LIMIT} characters`);
		return;
	}

	if (sourceLanguage.value === targetLanguage.value) {
		translatedText = text;
		lastCompletedRequestKey = buildRequestKey(text);
		setOutputSoftLoading(false);
		renderOutput(translatedText);
		setStatus('Same language');
		persistState();
		return;
	}

	const requestKey = buildRequestKey(text);
	if (requestKey === lastCompletedRequestKey && translatedText) {
		setOutputSoftLoading(false);
		renderOutput(translatedText);
		setStatus('Translated');
		return;
	}

	activeRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	activeRequestKey = requestKey;
	const protectedText = protectImageMarkers(text);
	activeTranslationMarkers = protectedText.markers;
	setLoading(true);
	setStatus('Translating');
	if (options.softLoading) {
		showOutputSoftLoading();
	} else {
		showSkeleton();
	}

	vscodeApi.postMessage({
		type: 'translate',
		id: activeRequestId,
		text: protectedText.text,
		from: sourceLanguage.value,
		to: targetLanguage.value,
	});
}

function buildRequestKey(text: string): string {
	return `${sourceLanguage.value}\u0000${targetLanguage.value}\u0000${text}`;
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
	spellcheckAction.disabled = count > CHAR_LIMIT;
}

function normalizeSourceInputCasing(): void {
	const normalizedText = normalizeInputCasing(sourceText.value);
	if (normalizedText === sourceText.value) { return; }

	const selectionStart = Math.min(sourceText.selectionStart, normalizedText.length);
	const selectionEnd = Math.min(sourceText.selectionEnd, normalizedText.length);
	sourceText.value = normalizedText;
	sourceText.setSelectionRange(selectionStart, selectionEnd);
}

function normalizeInputCasing(text: string): string {
	let hasFirstLetter = false;

	return replaceOutsideImageMarkers(text, (segment) => {
		let normalizedSegment = '';

		for (const char of segment) {
			if (!isLetter(char)) {
				normalizedSegment += char;
				continue;
			}

			if (!hasFirstLetter) {
				hasFirstLetter = true;
				normalizedSegment += char;
				continue;
			}

			normalizedSegment += char.toLocaleLowerCase();
		}

		return normalizedSegment;
	});
}

function replaceOutsideImageMarkers(
	text: string,
	replaceSegment: (segment: string) => string,
): string {
	let result = '';
	let lastIndex = 0;

	for (const match of text.matchAll(imageMarkerPattern)) {
		const index = match.index ?? 0;
		result += replaceSegment(text.slice(lastIndex, index));
		result += match[0];
		lastIndex = index + match[0].length;
	}

	result += replaceSegment(text.slice(lastIndex));
	return result;
}

function isLetter(value: string): boolean {
	return value.toLocaleLowerCase() !== value.toLocaleUpperCase();
}

function updateSourceHighlight(): void {
	sourceHighlight.replaceChildren(...buildHighlightedTextNodes(
		sourceText.value,
		'source-highlight__image-marker',
	));
	syncSourceHighlightScroll();
}

function buildHighlightedTextNodes(text: string, markerClassName: string): Node[] {
	if (!text) { return []; }

	const nodes: Node[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(imageMarkerPattern)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			nodes.push(document.createTextNode(text.slice(lastIndex, index)));
		}

		const marker = document.createElement('span');
		marker.className = markerClassName;
		marker.textContent = match[0];
		nodes.push(marker);
		lastIndex = index + match[0].length;
	}

	if (lastIndex < text.length) {
		nodes.push(document.createTextNode(text.slice(lastIndex)));
	}

	return nodes;
}

function syncSourceHighlightScroll(): void {
	sourceHighlight.scrollTop = sourceText.scrollTop;
	sourceHighlight.scrollLeft = sourceText.scrollLeft;
}

function renderOutput(text: string): void {
	if (!text) {
		lastRenderedText = '';
		translatedOutput.innerHTML = '<span class="empty-state">Your translation will appear here.</span>';
		copyAction.disabled = true;
		outputCard.classList.remove('has-content', 'is-soft-loading');
		return;
	}

	if (text === lastRenderedText && !translatedOutput.querySelector('.skeleton-line')) { return; }
	lastRenderedText = text;

	copyAction.disabled = false;
	outputCard.classList.add('has-content');

	const textNode = document.createElement('span');
	textNode.className = 'translation-output__text';
	textNode.replaceChildren(...buildHighlightedTextNodes(
		text,
		'translation-output__image-marker',
	));
	translatedOutput.replaceChildren(textNode);
}

function showSkeleton(): void {
	if (translatedOutput.querySelector('.skeleton-line')) { return; }
	lastRenderedText = '';
	outputCard.classList.remove('has-content', 'is-soft-loading');
	copyAction.disabled = true;
	translatedOutput.innerHTML = `
		<div class="skeleton-line" style="width:85%"></div>
		<div class="skeleton-line" style="width:70%"></div>
		<div class="skeleton-line" style="width:55%"></div>
	`;
}

function showOutputSoftLoading(): void {
	if (!translatedText) {
		renderOutput('');
	}

	outputCard.classList.add('is-soft-loading');
	copyAction.disabled = true;
}

function setOutputSoftLoading(isLoading: boolean): void {
	outputCard.classList.toggle('is-soft-loading', isLoading);
	if (!isLoading) {
		copyAction.disabled = !translatedText;
	}
}

function setStatus(message: string): void {
	statusText.textContent = message;
}

function buildProviderStatus(
	baseStatus: string,
	provider: unknown,
	fromCache: unknown,
): string {
	if (typeof provider !== 'string' || !provider) {
		return baseStatus;
	}

	return `${baseStatus} via ${provider}${fromCache ? ' (cached)' : ''}`;
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
		imageAttachments,
		nextImageAttachmentId,
	} satisfies PersistedState);
}

function handleSourcePaste(event: ClipboardEvent): void {
	const clipboardData = event.clipboardData;
	if (!clipboardData) { return; }

	const pastedText = clipboardData.getData('text/plain');
	const imageFiles = Array.from(clipboardData.items)
		.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
		.map((item) => item.getAsFile())
		.filter((file): file is File => file !== null);
	const textWithMarkers = replaceImagePathsWithMarkers(pastedText);
	const hasImagePath = textWithMarkers !== pastedText;

	if (!hasImagePath && !imageFiles.length) { return; }

	event.preventDefault();

	const imageMarkers = imageFiles.map(registerClipboardImageAttachment);
	const insertValue = [textWithMarkers, imageMarkers.join(' ')]
		.filter((part) => part.trim().length > 0)
		.join(textWithMarkers && imageMarkers.length ? ' ' : '');

	insertTextAtSelection(insertValue);
	persistState();
}

function replaceImagePathsWithMarkers(text: string): string {
	if (!text) { return text; }

	return text.replace(imagePathPattern, (match, doubleQuotedPath: string | undefined, singleQuotedPath: string | undefined, unquotedPath: string | undefined) => {
		const imagePath = doubleQuotedPath ?? singleQuotedPath ?? unquotedPath ?? match;
		return registerPathImageAttachment(imagePath.trim());
	});
}

function registerPathImageAttachment(path: string): string {
	const id = nextImageAttachmentId++;
	const marker = `[Image #${id}]`;
	imageAttachments.push({
		id,
		marker,
		source: 'path',
		path,
		type: getImageTypeFromPath(path),
		name: getPathBaseName(path),
	});
	return marker;
}

function registerClipboardImageAttachment(file: File): string {
	const id = nextImageAttachmentId++;
	const marker = `[Image #${id}]`;
	const attachment: ImageAttachment = {
		id,
		marker,
		source: 'clipboard',
		type: file.type || 'image/png',
		name: file.name || `Image ${id}`,
	};
	imageAttachments.push(attachment);

	const reader = new FileReader();
	reader.addEventListener('load', () => {
		if (typeof reader.result === 'string') {
			attachment.dataUrl = reader.result;
			persistState();
		}
	});
	reader.readAsDataURL(file);

	return marker;
}

function insertTextAtSelection(text: string): void {
	const start = sourceText.selectionStart;
	const end = sourceText.selectionEnd;
	const before = sourceText.value.slice(0, start);
	const after = sourceText.value.slice(end);
	const insertValue = addSmartSpacing(before, text, after);

	sourceText.value = before + insertValue + after;
	const cursorPosition = before.length + insertValue.length;
	sourceText.setSelectionRange(cursorPosition, cursorPosition);
	sourceText.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleImageMarkerDeleteKey(event: KeyboardEvent): boolean {
	if (event.key !== 'Backspace' && event.key !== 'Delete') { return false; }
	if (event.altKey || event.ctrlKey || event.metaKey) { return false; }
	if (sourceText.selectionStart !== sourceText.selectionEnd) { return false; }

	const caret = sourceText.selectionStart;
	const range = findImageMarkerDeleteRange(sourceText.value, caret, event.key);
	if (!range) { return false; }

	event.preventDefault();
	sourceText.value = sourceText.value.slice(0, range.start) + sourceText.value.slice(range.end);
	sourceText.setSelectionRange(range.start, range.start);
	sourceText.dispatchEvent(new Event('input', { bubbles: true }));
	return true;
}

function findImageMarkerDeleteRange(
	text: string,
	caret: number,
	key: 'Backspace' | 'Delete',
): { start: number; end: number } | undefined {
	for (const match of text.matchAll(imageMarkerPattern)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		const isInsideMarker = caret > start && caret < end;
		const isBackspaceAfterMarker = key === 'Backspace' && caret === end;
		const isDeleteBeforeMarker = key === 'Delete' && caret === start;

		if (isInsideMarker || isBackspaceAfterMarker || isDeleteBeforeMarker) {
			return { start, end };
		}
	}

	return undefined;
}

function addSmartSpacing(before: string, text: string, after: string): string {
	let value = text;
	if (before && !/\s$/.test(before) && value && !/^[\s,.;:!?)]/.test(value)) {
		value = ` ${value}`;
	}
	if (after && !/^\s/.test(after) && value && !/[\s([¿¡]$/.test(value)) {
		value = `${value} `;
	}
	return value;
}

function protectImageMarkers(text: string): { text: string; markers: ProtectedImageMarker[] } {
	const markers: ProtectedImageMarker[] = [];
	const protectedText = text.replace(imageMarkerPattern, (marker, id: string) => {
		const placeholder = `ZXQATMIMAGE${id}QXZ`;
		markers.push({ marker, placeholder });
		return placeholder;
	});

	return { text: protectedText, markers };
}

function restoreImageMarkers(text: string, markers: ProtectedImageMarker[]): string {
	return markers.reduce((result, { marker, placeholder }) =>
		result.replace(new RegExp(escapeRegExp(placeholder), 'g'), marker), text);
}

function getNextImageAttachmentId(): number {
	return imageAttachments.reduce((maxId, attachment) => Math.max(maxId, attachment.id), 0) + 1;
}

function getImageTypeFromPath(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase();
	if (!extension) { return 'image/*'; }
	if (extension === 'jpg') { return 'image/jpeg'; }
	if (extension === 'svg') { return 'image/svg+xml'; }
	if (extension === 'tif') { return 'image/tiff'; }
	return `image/${extension}`;
}

function getPathBaseName(path: string): string {
	return path.split('/').filter(Boolean).pop() ?? path;
}

function isImageAttachment(value: unknown): value is ImageAttachment {
	if (typeof value !== 'object' || value === null) { return false; }
	const attachment = value as Partial<ImageAttachment>;
	return typeof attachment.id === 'number'
		&& typeof attachment.marker === 'string'
		&& (attachment.source === 'path' || attachment.source === 'clipboard');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

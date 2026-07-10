export interface TranslateMessage {
	type: 'translate';
	id: string;
	text: string;
	from: string;
	to: string;
}

export interface CopyMessage {
	type: 'copy';
	text: string;
	attachments?: ImageAttachment[];
}

export interface SpellcheckMessage {
	type: 'spellcheck';
	id: string;
	text: string;
	language: string;
}

export interface SetTextMessage {
	type: 'setText';
	text: string;
}

export interface TranslatedMessage {
	type: 'translated';
	id: string;
	text: string;
	provider?: string;
	fromCache?: boolean;
}

export interface TranslationErrorMessage {
	type: 'translationError';
	id: string;
	message: string;
}

export interface SpellcheckResultMessage {
	type: 'spellcheckResult';
	id: string;
	text?: string;
	error?: string;
	provider?: string;
	fromCache?: boolean;
}

export interface ImageAttachment {
	id: number;
	marker: string;
	source: 'path' | 'clipboard';
	path?: string;
	dataUrl?: string;
	type?: string;
	name?: string;
	size?: number;
}

export type WebviewToHostMessage = TranslateMessage | CopyMessage | SpellcheckMessage;
export type HostToWebviewMessage = SetTextMessage | TranslatedMessage | TranslationErrorMessage | SpellcheckResultMessage;
export type UnknownMessage = unknown;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isTranslateMessage(message: unknown): message is TranslateMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'translate'
		&& typeof message.id === 'string'
		&& typeof message.text === 'string'
		&& typeof message.from === 'string'
		&& typeof message.to === 'string';
}

export function isCopyMessage(message: unknown): message is CopyMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'copy'
		&& typeof message.text === 'string'
		&& (
			message.attachments === undefined
			|| Array.isArray(message.attachments)
		);
}

export function isSpellcheckMessage(message: unknown): message is SpellcheckMessage {
	if (!isRecord(message)) { return false; }

	return message.type === 'spellcheck'
		&& typeof message.id === 'string'
		&& typeof message.text === 'string'
		&& typeof message.language === 'string';
}

export function isImageAttachment(value: unknown): value is ImageAttachment {
	if (!isRecord(value)) { return false; }

	return typeof value.id === 'number'
		&& typeof value.marker === 'string'
		&& (value.source === 'path' || value.source === 'clipboard')
		&& (value.path === undefined || typeof value.path === 'string')
		&& (value.dataUrl === undefined || typeof value.dataUrl === 'string')
		&& (value.type === undefined || typeof value.type === 'string')
		&& (value.name === undefined || typeof value.name === 'string')
		&& (value.size === undefined || typeof value.size === 'number');
}


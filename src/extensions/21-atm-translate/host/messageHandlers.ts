import * as vscode from 'vscode';
import { correctPlainText } from '../core/spellcheckService';
import { translatePlainText } from '../core/translationService';
import { maxTextLength } from '../shared/limits';
import { isValidSourceLanguage, isValidTargetLanguage } from '../shared/languages';
import {
	isCopyMessage,
	isSpellcheckMessage,
	isTranslateMessage,
	type SpellcheckMessage,
	type TranslateMessage,
	type UnknownMessage,
} from '../shared/protocol';
import { buildClipboardText } from './clipboardAttachments';

let activeAbortController: AbortController | undefined;
let activeSpellcheckAbortController: AbortController | undefined;

export async function handleWebviewMessage(
	panel: vscode.WebviewPanel,
	message: UnknownMessage,
	context: vscode.ExtensionContext,
): Promise<void> {
	if (isTranslateMessage(message)) {
		await handleTranslateMessage(panel, message, context.secrets);
		return;
	}

	if (isCopyMessage(message)) {
		const clipboardText = await buildClipboardText(message, context);
		await vscode.env.clipboard.writeText(clipboardText);
		return;
	}

	if (isSpellcheckMessage(message)) {
		await handleSpellcheckMessage(panel, message, context.secrets);
	}
}

export function abortActiveRequests(): void {
	activeAbortController?.abort();
	activeAbortController = undefined;
	activeSpellcheckAbortController?.abort();
	activeSpellcheckAbortController = undefined;
}

async function handleTranslateMessage(
	panel: vscode.WebviewPanel,
	message: TranslateMessage,
	secrets: vscode.SecretStorage,
): Promise<void> {
	const validationError = validateTranslatePayload(message.text, message.from, message.to);
	if (validationError) {
		await panel.webview.postMessage({
			type: 'translationError',
			id: message.id,
			message: validationError,
		});
		return;
	}

	activeAbortController?.abort();
	const controller = new AbortController();
	activeAbortController = controller;

	try {
		const result = await translatePlainText(
			{
				text: message.text,
				from: message.from,
				to: message.to,
				signal: controller.signal,
			},
			secrets,
		);

		await panel.webview.postMessage({
			type: 'translated',
			id: message.id,
			text: result.text,
			provider: result.providerName,
			fromCache: result.fromCache,
		});
	} catch (error) {
		if (controller.signal.aborted) { return; }

		await panel.webview.postMessage({
			type: 'translationError',
			id: message.id,
			message: error instanceof Error ? error.message : 'Translation failed.',
		});
	} finally {
		if (activeAbortController === controller) {
			activeAbortController = undefined;
		}
	}
}

async function handleSpellcheckMessage(
	panel: vscode.WebviewPanel,
	message: SpellcheckMessage,
	secrets: vscode.SecretStorage,
): Promise<void> {
	const text = message.text.trim();
	if (!text) {
		await panel.webview.postMessage({ type: 'spellcheckResult', id: message.id, text: '' });
		return;
	}

	if (text.length > maxTextLength) {
		await panel.webview.postMessage({
			type: 'spellcheckResult',
			id: message.id,
			error: `Text is too long. Keep spelling checks under ${maxTextLength} characters.`,
		});
		return;
	}

	if (!isValidSourceLanguage(message.language)) {
		await panel.webview.postMessage({
			type: 'spellcheckResult',
			id: message.id,
			error: 'Unsupported spell check language.',
		});
		return;
	}

	activeSpellcheckAbortController?.abort();
	const controller = new AbortController();
	activeSpellcheckAbortController = controller;

	try {
		const result = await correctPlainText(
			{
				text,
				language: message.language,
				signal: controller.signal,
			},
			secrets,
		);

		await panel.webview.postMessage({
			type: 'spellcheckResult',
			id: message.id,
			text: result.text,
			provider: result.providerName,
			fromCache: result.fromCache,
		});
	} catch (error) {
		if (controller.signal.aborted) { return; }

		await panel.webview.postMessage({
			type: 'spellcheckResult',
			id: message.id,
			error: error instanceof Error ? error.message : 'Spell check failed.',
		});
	} finally {
		if (activeSpellcheckAbortController === controller) {
			activeSpellcheckAbortController = undefined;
		}
	}
}

function validateTranslatePayload(text: string, from: string, to: string): string | undefined {
	if (!text.trim()) { return undefined; }
	if (text.trim().length > maxTextLength) {
		return `Text is too long. Keep translations under ${maxTextLength} characters.`;
	}
	if (!isValidSourceLanguage(from)) {
		return 'Unsupported source language.';
	}
	if (!isValidTargetLanguage(to)) {
		return 'Unsupported target language.';
	}
	return undefined;
}

import * as vscode from 'vscode';
import { collectImageMarkerIds, formatPromptTaskText } from '../shared/imageMarkers';
import { type CopyMessage, type ImageAttachment, isImageAttachment } from '../shared/protocol';

export async function buildClipboardText(
	message: CopyMessage,
	context: vscode.ExtensionContext,
): Promise<string> {
	const attachments = getReferencedAttachments(message.text, message.attachments ?? []);
	if (!attachments.length) { return message.text; }

	const taskText = formatPromptTaskText(message.text);
	const metadataLines = await Promise.all(attachments.map((attachment) =>
		buildAttachmentMetadata(attachment, context)
	));

	return [
		'Task:',
		taskText,
		'',
		'Attachments:',
		metadataLines.join('\n\n'),
	].join('\n');
}

function getReferencedAttachments(
	text: string,
	attachments: ImageAttachment[],
): ImageAttachment[] {
	const markerIds = collectImageMarkerIds(text);
	return attachments.filter((attachment) =>
		isImageAttachment(attachment) && markerIds.has(attachment.id)
	);
}

async function buildAttachmentMetadata(
	attachment: ImageAttachment,
	context: vscode.ExtensionContext,
): Promise<string> {
	const path = attachment.path ?? await saveClipboardImageAttachment(attachment, context);
	const lines = [
		`${attachment.marker}`,
	];

	if (path) {
		lines.push(`Path: ${path}`);
	}
	if (attachment.type) {
		lines.push(`Type: ${attachment.type}`);
	}
	if (attachment.name) {
		lines.push(`Name: ${attachment.name}`);
	}
	lines.push(`Source: ${attachment.source}`);

	return lines.join('\n');
}

async function saveClipboardImageAttachment(
	attachment: ImageAttachment,
	context: vscode.ExtensionContext,
): Promise<string | undefined> {
	if (!attachment.dataUrl) { return undefined; }

	const parsed = parseDataUrl(attachment.dataUrl);
	if (!parsed) { return undefined; }

	const imageDir = vscode.Uri.joinPath(context.globalStorageUri, 'atm-translate', 'images');
	await vscode.workspace.fs.createDirectory(imageDir);

	const extension = getImageExtension(parsed.mimeType, attachment.name);
	const fileName = `image-${attachment.id}-${Date.now()}${extension}`;
	const fileUri = vscode.Uri.joinPath(imageDir, fileName);
	await vscode.workspace.fs.writeFile(fileUri, parsed.bytes);

	attachment.path = fileUri.fsPath;
	return fileUri.fsPath;
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | undefined {
	const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
	if (!match) { return undefined; }

	return {
		mimeType: match[1],
		bytes: Buffer.from(match[2], 'base64'),
	};
}

function getImageExtension(mimeType: string, name?: string): string {
	const nameExtension = name?.match(/\.[a-z0-9]+$/i)?.[0];
	if (nameExtension) { return nameExtension.toLowerCase(); }

	switch (mimeType) {
		case 'image/jpeg':
			return '.jpg';
		case 'image/png':
			return '.png';
		case 'image/gif':
			return '.gif';
		case 'image/webp':
			return '.webp';
		case 'image/svg+xml':
			return '.svg';
		default:
			return '.png';
	}
}


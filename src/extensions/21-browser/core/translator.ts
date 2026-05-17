import { translate } from '@vitalets/google-translate-api';

export interface TranslationRequest {
	text: string;
	from: string;
	to: string;
	signal?: AbortSignal;
}

export async function translatePlainText({
	text,
	from,
	to,
	signal,
}: TranslationRequest): Promise<string> {
	const cleanText = text.trim();
	if (!cleanText) { return ''; }

	const options: {
		to: string;
		from?: string;
		fetchOptions: { signal?: AbortSignal };
	} = {
		to,
		fetchOptions: { signal },
	};

	if (from && from !== 'auto') {
		options.from = from;
	}

	const result = await translate(cleanText, options);
	return result.text;
}

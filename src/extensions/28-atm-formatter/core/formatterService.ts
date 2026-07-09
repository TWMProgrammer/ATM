import { format as prettierFormat } from 'prettier/standalone';
import { bundledPlugins } from './prettierPlugins';
import { languageRegistry } from './languageRegistry';
import type { FormatDocumentInput, FormatRangeInput, FormatResult } from './types';

/**
 * Core formatting service — language-agnostic pipeline that delegates to
 * Prettier's standalone API with the bundled plugin set.
 *
 * The host layer (VS Code providers) calls this service after resolving
 * the parser and config.  This class has zero VS Code dependencies, making
 * it unit-testable in isolation.
 */
export class FormatterService {
	/**
	 * Format a full document.
	 * @returns the formatted text, or the original text on error.
	 */
	async formatDocument(input: FormatDocumentInput): Promise<FormatResult> {
		try {
			const formatted = await prettierFormat(input.text, {
				parser: input.parser,
				plugins: bundledPlugins,
				filepath: input.filepath,
				...input.config,
			});
			return { formatted };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { formatted: input.text, error: message };
		}
	}

	/**
	 * Format a range within a document.
	 * Only call this for languages with `rangeFormatting: true`.
	 */
	async formatRange(input: FormatRangeInput): Promise<FormatResult> {
		try {
			const formatted = await prettierFormat(input.text, {
				parser: input.parser,
				plugins: bundledPlugins,
				filepath: input.filepath,
				rangeStart: input.rangeStart,
				rangeEnd: input.rangeEnd,
				...input.config,
			});
			return { formatted };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { formatted: input.text, error: message };
		}
	}

	/** Whether a VS Code language ID is supported by this formatter. */
	isLanguageSupported(languageId: string): boolean {
		return languageRegistry.isLanguageSupported(languageId);
	}

	/** Get the primary Prettier parser for a VS Code language ID. */
	getParserForLanguageId(languageId: string): string | undefined {
		const descriptor = languageRegistry.getByLanguageId(languageId);
		return descriptor?.parsers[0];
	}

	/** Whether a language supports range (selection) formatting. */
	supportsRangeFormatting(languageId: string): boolean {
		const descriptor = languageRegistry.getByLanguageId(languageId);
		return descriptor?.rangeFormatting ?? false;
	}
}

/** Singleton service instance. */
export const formatterService = new FormatterService();

import type { LanguageDescriptor } from './types';
import { languageDescriptors } from './languages';

/**
 * Central registry for looking up language descriptors by VS Code language ID
 * or file extension.  Built once from the `languageDescriptors` array.
 *
 * This is the single read-point the rest of the extension uses to answer
 * "is this language supported?" and "which parser should I use?".
 */
class LanguageRegistry {
	private readonly byLanguageId = new Map<string, LanguageDescriptor>();
	private readonly byExtension = new Map<string, LanguageDescriptor>();
	private readonly enabledDescriptors: LanguageDescriptor[];

	constructor(descriptors: LanguageDescriptor[]) {
		this.enabledDescriptors = descriptors.filter((d) => d.enabled);

		for (const desc of this.enabledDescriptors) {
			for (const langId of desc.vscodeLanguageIds) {
				this.byLanguageId.set(langId, desc);
			}
			for (const ext of desc.extensions) {
				this.byExtension.set(ext.toLowerCase(), desc);
			}
		}
	}

	/** Returns the descriptor for a VS Code language ID, or `undefined`. */
	getByLanguageId(languageId: string): LanguageDescriptor | undefined {
		return this.byLanguageId.get(languageId);
	}

	/** Returns the descriptor for a file extension (with dot), or `undefined`. */
	getByExtension(extension: string): LanguageDescriptor | undefined {
		return this.byExtension.get(extension.toLowerCase());
	}

	/** Whether a VS Code language ID is supported and enabled. */
	isLanguageSupported(languageId: string): boolean {
		return this.byLanguageId.has(languageId);
	}

	/** All enabled descriptors. */
	getEnabled(): readonly LanguageDescriptor[] {
		return this.enabledDescriptors;
	}

	/** All VS Code language IDs that are enabled. */
	getEnabledLanguageIds(): readonly string[] {
		const ids = new Set<string>();
		for (const desc of this.enabledDescriptors) {
			for (const id of desc.vscodeLanguageIds) {
				ids.add(id);
			}
		}
		return [...ids];
	}

	/** All VS Code language IDs that support range formatting. */
	getRangeFormattingLanguageIds(): readonly string[] {
		const ids = new Set<string>();
		for (const desc of this.enabledDescriptors) {
			if (desc.rangeFormatting) {
				for (const id of desc.vscodeLanguageIds) {
					ids.add(id);
				}
			}
		}
		return [...ids];
	}

	/** All file extensions (with dot, lowercase) from enabled descriptors. */
	getEnabledExtensions(): readonly string[] {
		const exts = new Set<string>();
		for (const desc of this.enabledDescriptors) {
			for (const ext of desc.extensions) {
				exts.add(ext.toLowerCase());
			}
		}
		return [...exts];
	}
}

/** Singleton registry instance. */
export const languageRegistry = new LanguageRegistry(languageDescriptors);

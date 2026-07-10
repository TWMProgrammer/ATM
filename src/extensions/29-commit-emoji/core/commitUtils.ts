import type { Repository } from './git';

/**
 * Inserts `valueOfCommitEmoji` into the repository commit message box.
 *
 * - `asSuffix = false` → strips existing leading emoji/codes, then prepends.
 * - `asSuffix = true`  → strips existing trailing emoji/codes, then appends.
 * - `canRepeat = true` → skips stripping; allows multiple emoji in sequence.
 */
export function updateCommit(
	repository: Repository,
	valueOfCommitEmoji: string,
	asSuffix: boolean,
	tokensToStrip: string[],
	canRepeat: boolean = false,
): void {
	const tokenPattern = buildTokenPattern(tokensToStrip);
	const startTokenRegex = new RegExp(`^(?:${tokenPattern})(?:\\s+|$)`);
	const endTokenRegex = new RegExp(`(?:\\s+|^)(${tokenPattern})$`);

	let current = repository.inputBox.value;

	if (!asSuffix) {
		if (!canRepeat) {
			current = removeLeadingTokens(current, startTokenRegex);
		}
		repository.inputBox.value = `${valueOfCommitEmoji} ${current}`;
	} else {
		if (!canRepeat) {
			current = removeTrailingTokens(current, endTokenRegex);
		}
		const sep = current.length > 0 ? ' ' : '';
		repository.inputBox.value = `${current}${sep}${valueOfCommitEmoji}`;
	}
}

/**
 * Builds a regex alternation pattern from the given token list, escaping
 * each token so special regex characters are treated literally.
 */
export function buildTokenPattern(tokens: string[]): string {
	return tokens.map(escapeRegExp).filter((t) => t.length > 0).join('|');
}

/**
 * Repeatedly removes consecutive leading commit emoji tokens from `text`.
 */
export function removeLeadingTokens(text: string, tokenAtStart: RegExp): string {
	let result = text.replace(/^\s+/, '');
	while (tokenAtStart.test(result)) {
		result = result.replace(tokenAtStart, '');
		result = result.replace(/^\s+/, '');
	}
	return result;
}

/**
 * Repeatedly removes consecutive trailing commit emoji tokens from `text`.
 */
export function removeTrailingTokens(text: string, tokenAtEnd: RegExp): string {
	let result = text.replace(/\s+$/, '');
	while (tokenAtEnd.test(result)) {
		result = result.replace(tokenAtEnd, '');
		result = result.replace(/\s+$/, '');
	}
	return result;
}

/**
 * Escapes all regex special characters in `str` so it can be used as a
 * literal pattern inside a RegExp constructor.
 */
export function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

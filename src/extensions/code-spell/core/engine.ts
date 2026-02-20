import { tokenizeText } from './tokenizer';
import { isWordValid } from './dictionary';

export interface SpellIssue {
  word: string;
  offset: number;
  length: number;
}

/**
 * Scans text and returns spelling issues.
 * Automatically ignores numbers and URLs.
 */
export function checkText(text: string): SpellIssue[] {
  const issues: SpellIssue[] = [];

  // Remove raw URLs from text while preserving the length to maintain correct token offsets
  const cleanText = text.replace(/https?:\/\/[^\s"'<>]*/g, (match) =>
    ' '.repeat(match.length),
  );

  const tokens = tokenizeText(cleanText);

  for (const token of tokens) {
    const isValid = isWordValid(token.text);
    if (!isValid) {
      issues.push({
        word: token.text,
        offset: token.offset,
        length: token.length,
      });
    }
  }

  return issues;
}

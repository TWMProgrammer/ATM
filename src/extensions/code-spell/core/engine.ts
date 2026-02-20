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

  // Remove raw URLs from text before tokenization
  const cleanText = text.replace(/https?:\/\/[^\s"'<>]*/g, ' ');

  const tokens = tokenizeText(cleanText);

  for (const token of tokens) {
    // Ignore purely numeric or hex values
    if (/^[0-9]+$/.test(token.text)) {
      continue;
    }
    if (/^0x[0-9a-fA-F]+$/.test(token.text)) {
      continue;
    }

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

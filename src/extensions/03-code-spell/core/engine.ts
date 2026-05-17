import { tokenizeText } from './tokenizer';
import { isWordValid } from './dictionary';

export interface SpellIssue {
  word: string;
  offset: number;
  length: number;
}

/* =========================================================
 * 🔍 CHECK TEXT ENGINE
 * Scans text and returns spelling issues.
 * Automatically ignores numbers, URLs, Hex Colors (#FFF) AND CamelCase/PascalCase variables.
 * ========================================================= */
export function checkText(text: string): SpellIssue[] {
  const issues: SpellIssue[] = [];

  const lines = text.split('\n');
  let currentOffset = 0;

  for (const line of lines) {
    const lineLen = line.length;

    /* =========================================================
     * ⏩ SKIP LONG LINES
     * Skip excessively long lines (e.g. base64 strings, embedded resources)
     * to prevent regex catastrophic backtracking and UI lag.
     * ========================================================= */
    if (lineLen > 1000) {
      currentOffset += lineLen + 1; // +1 for the '\n'
      continue;
    }

    const cleanLine = line.replace(
      /https?:\/\/[^\s"'<>]*|#[a-fA-F0-9]{3,8}\b/g,
      (match) => ' '.repeat(match.length),
    );

    const tokens = tokenizeText(cleanLine);

    for (const token of tokens) {
      // Check if the remaining word is spelled correctly
      const isValid = isWordValid(token.text);
      if (!isValid) {
        issues.push({
          word: token.text,
          offset: currentOffset + token.offset,
          length: token.length,
        });
      }
    }

    currentOffset += lineLen + 1; // +1 for the '\n'
  }

  return issues;
}

import { tokenizeText } from './tokenizer';
import { isWordValid } from './dictionary';

export interface SpellIssue {
  word: string;
  offset: number;
  length: number;
}

/**
 * Scans text and returns spelling issues.
 * Automatically ignores numbers, URLs, Hex Colors (#FFF) AND CamelCase/PascalCase variables.
 */
export function checkText(text: string): SpellIssue[] {
  const issues: SpellIssue[] = [];

  // Remove raw URLs, Hexadecimal Colors (#FFFFFF) AND ANY camelCase / PascalCase words
  // e.g: useSafeAreaInsets, StyleSheet, TouchableOpacity, AnalyticsResult
  // while preserving the original length to maintain correct token offsets
  const cleanText = text.replace(
    /https?:\/\/[^\s"'<>]*|#[a-fA-F0-9]{3,8}\b|\b(?:[a-z]+[A-Z][a-zA-Z]*|[A-Z][a-z]+[A-Z][a-zA-Z]*)\b/g,
    (match) => ' '.repeat(match.length),
  );

  const tokens = tokenizeText(cleanText);

  for (const token of tokens) {
    // Revisar si la palabra restante (en minúsculas completas o 1 sola mayúscula pura) está mal escrita
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

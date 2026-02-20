export interface Token {
  text: string;
  offset: number;
  length: number;
}

/**
 * Tokenizes text, ignoring punctuation and splitting camelCase,
 * PascalCase, and snake_case words.
 * Example: "myVariable_name" -> "my", "Variable", "name"
 */
export function tokenizeText(text: string): Token[] {
  const tokens: Token[] = [];

  // Captures words including camelCase and PascalCase
  // Example: "XMLHttpRequest" becomes "XML", "Http", "Request"
  const regex = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const word = match[0];

    // Ignore single letters strings to reduce noise
    if (word.length >= 2) {
      tokens.push({
        text: word,
        offset: match.index,
        length: word.length,
      });
    }
  }

  return tokens;
}

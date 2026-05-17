export interface Token {
  text: string;
  offset: number;
  length: number;
}

/* =========================================================
 * ✂️ TOKENIZE TEXT
 * Tokenizes text, ignoring punctuation and splitting camelCase,
 * PascalCase, and snake_case words.
 * Example: "myVariable_name" -> "my", "Variable", "name"
 * ========================================================= */
export function tokenizeText(text: string): Token[] {
  const tokens: Token[] = [];

  /* =========================================================
   * 🛡️ SANITIZE TEXT (Preserving Offsets)
   * Ignore URLs, Emails, and Hex Colors by replacing them with spaces
   * ========================================================= */
  const sanitizedText = text
    .replace(/https?:\/\/[^\s"'`<>]+/g, (m) => ' '.repeat(m.length))
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => ' '.repeat(m.length))
    .replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => ' '.repeat(m.length));

  /* =========================================================
   * 🎯 CAPTURE WORDS
   * Captures words including camelCase and PascalCase
   * Example: "XMLHttpRequest" becomes "XML", "Http", "Request"
   * ========================================================= */
  const regex = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g;

  let match;
  while ((match = regex.exec(sanitizedText)) !== null) {
    const word = match[0];

    /* =========================================================
     * 🔇 IGNORE NOISE
     * Ignore single letters strings to reduce noise, and filter
     * out Base64/hashes (extremely long or no vowels) to prevent freezes.
     * ========================================================= */
    if (word.length >= 2) {
      if (word.length > 45 || !/[aeiouyAEIOUY]/.test(word)) {
        continue;
      }

      tokens.push({
        text: word,
        offset: match.index,
        length: word.length,
      });
    }
  }

  return tokens;
}

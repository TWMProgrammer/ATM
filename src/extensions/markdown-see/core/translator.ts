import { translate } from '@vitalets/google-translate-api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Google Translate has a ~5000 char limit per request; stay safely under. */
const MAX_CHUNK_SIZE = 4500;

/**
 * Patterns that must NOT be translated (order matters — larger first).
 * Each match is replaced with a placeholder before translation and
 * restored afterwards.
 */
const PROTECTED_PATTERNS: RegExp[] = [
  /```[\s\S]*?```/g,            // Fenced code blocks
  /`[^`\n]+`/g,                 // Inline code
  /!\[[^\]]*\]\([^)]+\)/g,      // Markdown images  ![alt](url)
  /\[[^\]]*\]\([^)]+\)/g,       // Markdown links   [text](url)
  /<[^>]+>/g,                    // HTML tags
  /https?:\/\/[^\s)>\]]+/g,     // Raw URLs
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate a (potentially large) Markdown text while preserving URLs,
 * images, code blocks, and other non-translatable patterns.
 */
export async function translateText(
  text: string,
  targetLanguageCode: string
): Promise<string> {
  // 1. Protect URLs, images, code blocks, etc.
  const { text: safeText, placeholders } = protectPatterns(text);

  // 2. Split into chunks to stay under the character limit
  const chunks = splitIntoChunks(safeText);

  // 3. Translate each chunk sequentially
  const translated: string[] = [];

  for (const chunk of chunks) {
    const result = await translate(chunk, { to: targetLanguageCode });
    translated.push(result.text);
  }

  // 4. Re-join and restore protected content
  const joined = translated.join('\n\n');
  return restorePlaceholders(joined, placeholders);
}

// ---------------------------------------------------------------------------
// Placeholder protection
// ---------------------------------------------------------------------------

interface Placeholder {
  id: string;
  original: string;
}

/**
 * Replace all non-translatable segments with numbered placeholders.
 */
function protectPatterns(
  text: string
): { text: string; placeholders: Placeholder[] } {
  const placeholders: Placeholder[] = [];
  let counter = 0;
  let result = text;

  for (const pattern of PROTECTED_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const id = `%%P${counter++}%%`;
      placeholders.push({ id, original: match });
      return id;
    });
  }

  return { text: result, placeholders };
}

/**
 * Restore placeholders back to their originals.
 * Handles the case where Google Translate may add extra spaces
 * around the placeholder markers (e.g. "%%P0%%" → "%% P0 %%").
 */
function restorePlaceholders(
  text: string,
  placeholders: Placeholder[]
): string {
  let result = text;

  for (const { id, original } of placeholders) {
    // Try exact match first (fast path)
    if (result.includes(id)) {
      result = result.split(id).join(original);
    } else {
      // Flexible match: allow optional spaces Google Translate may insert
      const num = id.replace(/%%P(\d+)%%/, '$1');
      const flexible = new RegExp(`%%\\s*P\\s*${num}\\s*%%`, 'g');
      result = result.replace(flexible, original);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split text into chunks ≤ MAX_CHUNK_SIZE, breaking at paragraph boundaries
 * (\n\n) when possible, and falling back to line breaks (\n) for very long
 * single paragraphs.
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) { return [text]; }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    // Would adding this paragraph exceed the limit?
    if (current.length + para.length + 2 > MAX_CHUNK_SIZE) {
      if (current) { chunks.push(current); }

      // If a single paragraph itself exceeds the limit, split by lines
      if (para.length > MAX_CHUNK_SIZE) {
        const lines = para.split('\n');
        let lineBuf = '';
        for (const line of lines) {
          if (lineBuf.length + line.length + 1 > MAX_CHUNK_SIZE) {
            if (lineBuf) { chunks.push(lineBuf); }
            lineBuf = line;
          } else {
            lineBuf = lineBuf ? lineBuf + '\n' + line : line;
          }
        }
        current = lineBuf;
      } else {
        current = para;
      }
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }

  if (current) { chunks.push(current); }
  return chunks;
}

import { translate } from '@vitalets/google-translate-api';

// =========================================================
// ⚙️ CONSTANTS
// =========================================================

/** Google Translate has a ~5000 char limit per request; stay safely under. */
const MAX_CHUNK_SIZE = 4500;

/** Max concurrent translation requests to avoid rate-limiting. */
const BATCH_SIZE = 3;

/**
 * Patterns that must NOT be translated (order matters — most specific first).
 * Each match is replaced with a placeholder before translation and
 * restored afterwards.
 */
const PROTECTED_PATTERNS: RegExp[] = [
  // ── Block-level ──────────────────────────────────────────
  /```[\s\S]*?```/g,                             // Fenced code blocks (```sh, ```py, etc.)

  // ── Inline code ──────────────────────────────────────────
  /`[^`\n]+`/g,                                  // Inline code spans

  // ── Markdown: nested badges (must come before images/links) ──
  /\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)/g,          // [![alt](img-url)](link-url)

  // ── Markdown: images & links ─────────────────────────────
  /!\[[^\]]*\]\([^)]+\)/g,                       // ![alt](url)
  /\[[^\]]*\]\([^)]+\)/g,                        // [text](url)

  // ── HTML ─────────────────────────────────────────────────
  /<[^>]+>/g,                                    // HTML/XML tags

  // ── CLI / package-manager commands ───────────────────────
  /(?:npm|yarn|pnpm|bun|npx|pip|pip3|cargo|gem|composer|brew|apt|apt-get|dnf|pacman|choco|winget|go|deno)\s+(?:install|add|i|run|exec|create|init|update|upgrade|remove|uninstall|get|build|test|start|dev|publish|global)\b[^\n]*/gi,

  // ── VS Code extension install ────────────────────────────
  /ext\s+install\s+[\w.-]+/gi,

  // ── Raw URLs ─────────────────────────────────────────────
  /https?:\/\/[^\s)>\]]+/g,

  // ── Email addresses ──────────────────────────────────────
  /[\w.-]+@[\w.-]+\.\w{2,}/g,

  // ── File & directory paths ───────────────────────────────
  /(?:\.{1,2}\/|~\/)[^\s)>\]"']+/g,             // ./path, ../path, ~/path
];

// =========================================================
// 🚀 PUBLIC API
// =========================================================

/**
 * Translate a (potentially large) Markdown text while preserving URLs,
 * images, code blocks, commands, and other non-translatable patterns.
 */
export async function translateText(
  text: string,
  targetLanguageCode: string
): Promise<string> {
  // 1. Protect non-translatable content with placeholders
  const { text: safeText, placeholders } = protectPatterns(text);

  // 2. Split into chunks to stay under the character limit
  const chunks = splitIntoChunks(safeText);

  // 3. Translate chunks in parallel batches
  const translated: string[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((chunk) => translate(chunk, { to: targetLanguageCode }))
    );
    translated.push(...results.map((r) => r.text));
  }

  // 4. Re-join and restore protected content
  const joined = translated.join('\n\n');
  return restorePlaceholders(joined, placeholders);
}

// =========================================================
// 🛡️ PLACEHOLDER SYSTEM
// Uses {{0}}, {{1}}, ... format — template-style double braces that
// Google Translate reliably preserves across all languages.
// =========================================================

interface Placeholder {
  tag: string;
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
      const tag = `{{${counter}}}`;
      placeholders.push({ tag, original: match });
      counter++;
      return tag;
    });
  }

  return { text: result, placeholders };
}

/**
 * Restore placeholders back to their originals.
 * Handles the edge-case where Google Translate may:
 *  - add spaces:          {{0}} → {{ 0 }}
 *  - use full-width chars: {{0}} → ｛｛0｝｝
 *  - separate braces:     {{0}} → { {0} }
 */
function restorePlaceholders(
  text: string,
  placeholders: Placeholder[]
): string {
  let result = text;

  for (const { tag, original } of placeholders) {
    const num = tag.match(/\d+/)![0];

    // Fast path: exact match
    if (result.includes(tag)) {
      result = result.replaceAll(tag, original);
      continue;
    }

    // Flexible match: handle spacing and full-width variants
    const flex = new RegExp(
      // Normal braces with optional spaces
      `\\{\\{\\s*${num}\\s*\\}\\}` +
      // Full-width braces ｛｝
      `|\\uff5b\\uff5b\\s*${num}\\s*\\uff5d\\uff5d` +
      // Mixed: { { 0 } }
      `|\\{\\s*\\{\\s*${num}\\s*\\}\\s*\\}`,
      'g'
    );
    result = result.replace(flex, original);
  }

  return result;
}

// =========================================================
// 🧩 CHUNKING
// =========================================================

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

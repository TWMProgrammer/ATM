import type { Recognizer, UrlMatch } from './types';
import { ACCEPTED_EXTENSIONS } from './types';

// ─── Link Recognizer ────────────────────────────────────────────────
// Detects http(s) and ftp URLs

const LINK_PATTERN =
  /(?:(?:https?|ftp):\/\/|\b(?:[a-z\d]+\.))(?:(?:[^\s()<>]+|\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))?\))+(?:\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))?\)|[^\s`!()\[\]{};:'".,<>?«»""'']))?/gi;

const linkRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    LINK_PATTERN.lastIndex = 0;
    while ((match = LINK_PATTERN.exec(line)) !== null) {
      results.push({
        url: match[0],
        lineIndex,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return results;
  },
};

// ─── Local Link Recognizer ──────────────────────────────────────────
// Detects file-system paths (Unix & Windows)

const UNIX_PATH =
  /(([a-zA-Z]{2,}:)|(\.\.?|~)|([^\0\s!$`&*()\[\]+'":;\\])+)?(\/([^\0\s!$`&*()\[\]+'":;\\])+)+/g;

const localLinkRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    UNIX_PATH.lastIndex = 0;
    while ((match = UNIX_PATH.exec(line)) !== null) {
      if (match[0]) {
        results.push({
          url: match[0],
          lineIndex,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    return results;
  },
};

// ─── Data URL Recognizer ────────────────────────────────────────────
// Detects inline data:image URIs

function collectDataMatches(pattern: RegExp, lineIndex: number, line: string): UrlMatch[] {
  const results: UrlMatch[] = [];
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(line)) !== null) {
    if (match[1]) {
      results.push({
        url: match[1],
        lineIndex,
        start: match.index,
        end: match.index + match[1].length,
      });
    }
  }
  return results;
}

const dataUrlRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    let results: UrlMatch[] = [];
    // CSS url() variants
    results.push(...collectDataMatches(/url\('(data:image[^']*)'\)/gim, lineIndex, line));
    results.push(...collectDataMatches(/url\("(data:image[^"]*)"\)/gim, lineIndex, line));
    if (results.length === 0) {
      // Bare string variants
      results.push(...collectDataMatches(/'(data:image[^']*)'/gim, lineIndex, line));
      results.push(...collectDataMatches(/"(data:image[^"]*)"/gim, lineIndex, line));
      results.push(...collectDataMatches(/`(data:image[^`]*)`/gim, lineIndex, line));
    }
    return results;
  },
};

// ─── Sibling File Recognizer ────────────────────────────────────────
// Detects filenames with known image extensions

const siblingRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const extGroup = ACCEPTED_EXTENSIONS.map((e) => `(\\${e})`).join('|');
    const pattern = new RegExp(`([^\\0\\s!$\`&*()\\[\\]+'":;\\\\]+[${extGroup}])`, 'ig');
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      results.push({
        url: match[0],
        lineIndex,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return results;
  },
};

// ─── Markdown Link Recognizer ───────────────────────────────────────
// Detects ![alt](path) and [text](path) patterns

const MARKDOWN_LINK = /(\[.*?\])\(([^")]*?)(?:\s*".*?")?\)/gi;

const markedLinkRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    MARKDOWN_LINK.lastIndex = 0;
    while ((match = MARKDOWN_LINK.exec(line)) !== null) {
      const imagePath = match[2].trim();
      const offset = match.index + match[1].length + 1;
      results.push({
        url: imagePath,
        lineIndex,
        start: offset,
        end: offset + imagePath.length,
      });
    }
    return results;
  },
};

// ─── Export all recognizers in priority order ────────────────────────

export const recognizers: Recognizer[] = [
  markedLinkRecognizer,
  dataUrlRecognizer,
  linkRecognizer,
  localLinkRecognizer,
  siblingRecognizer,
];

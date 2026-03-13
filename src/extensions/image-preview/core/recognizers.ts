import type { Recognizer, UrlMatch } from './types';
import { ACCEPTED_EXTENSIONS } from './types';

// =========================================================
// 🔗 LINK RECOGNIZER
// Detects http(s) and ftp URLs
// =========================================================

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

// =========================================================
// 💻 LOCAL LINK RECOGNIZER
// Detects file-system paths (Unix & Windows)
// =========================================================

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

// =========================================================
// 🖼️ DATA URL RECOGNIZER
// Detects inline data:image URIs
// =========================================================

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

// =========================================================
// 📁 SIBLING FILE RECOGNIZER
// Detects filenames with known image extensions (regex pre-compiled once)
// =========================================================

const SIBLING_PATTERN = new RegExp(
  `([^\\0\\s!$\`&*()\\[\\]+'":;\\\\]+(?:${ACCEPTED_EXTENSIONS.map((e) => e.replace('.', '\\.')).join('|')}))(?=[\\s'"\`)\\]},;]|$)`,
  'gi',
);

const siblingRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    SIBLING_PATTERN.lastIndex = 0;
    while ((match = SIBLING_PATTERN.exec(line)) !== null) {
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

// =========================================================
// 📝 MARKDOWN IMAGE RECOGNIZERS
// Detects markdown images and <img src="..."> tags
// =========================================================

const MARKDOWN_IMAGE = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/gi;
const HTML_IMAGE_TAG = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

const markdownImageRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    MARKDOWN_IMAGE.lastIndex = 0;
    while ((match = MARKDOWN_IMAGE.exec(line)) !== null) {
      const imagePath = (match[1] ?? match[2] ?? '').trim();
      if (!imagePath) { continue; }
      const relativeStart = match[0].indexOf(imagePath);
      if (relativeStart < 0) { continue; }
      const offset = match.index + relativeStart;
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

const htmlImageRecognizer: Recognizer = {
  recognize(lineIndex, line) {
    const results: UrlMatch[] = [];
    let match: RegExpExecArray | null;
    HTML_IMAGE_TAG.lastIndex = 0;
    while ((match = HTML_IMAGE_TAG.exec(line)) !== null) {
      const imagePath = (match[1] ?? match[2] ?? match[3] ?? '').trim();
      if (!imagePath) { continue; }
      const relativeStart = match[0].indexOf(imagePath);
      if (relativeStart < 0) { continue; }
      const offset = match.index + relativeStart;
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

// =========================================================
// 🚀 EXPORT ALL RECOGNIZERS IN PRIORITY ORDER
// =========================================================

export const recognizers: Recognizer[] = [
  dataUrlRecognizer,
  linkRecognizer,
  localLinkRecognizer,
  siblingRecognizer,
];

export const markdownRecognizers: Recognizer[] = [
  markdownImageRecognizer,
  htmlImageRecognizer,
  dataUrlRecognizer,
  siblingRecognizer,
];

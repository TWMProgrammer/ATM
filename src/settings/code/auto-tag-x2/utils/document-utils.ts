import * as vscode from 'vscode';

/**
 * Gets the text of a specific line from a document.
 */
export function getLineText(
  document: vscode.TextDocument,
  lineIndex: number,
): string {
  return document.lineAt(lineIndex).text;
}

/**
 * Parses tag info to extract name and check if it's a closing tag.
 */
export function parseTagInfo(
  tagString: string,
): { name: string; isClosing: boolean } | null {
  const match = tagString.match(/<\/?([a-zA-Z0-9\-]+)[^>]*>/);
  if (!match) {
    return null;
  }
  return { name: match[1], isClosing: tagString.startsWith('</') };
}

/**
 * List of self-closing tags.
 */
export const SELF_CLOSING_TAGS = new Set([
  'br',
  'hr',
  'img',
  'input',
  'meta',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'param',
  'source',
  'track',
  'wbr',
]);

import * as vscode from 'vscode';

/**
 * Obtiene el texto de una línea específica de un documento.
 */
export function getLineText(
  document: vscode.TextDocument,
  lineIndex: number,
): string {
  return document.lineAt(lineIndex).text;
}

/**
 * Verifica si es una etiqueta de cierre o apertura válida y extrae su nombre.
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
 * Lista ligera de etiquetas que no necesitan cierre (self-closing).
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

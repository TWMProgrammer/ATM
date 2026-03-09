import * as vscode from 'vscode';
import { SUPPORTED_LANGUAGES } from '../utils/config';
import { parseTagInfo, SELF_CLOSING_TAGS } from '../utils/document-utils';

export function registerAutoRename(context: vscode.ExtensionContext) {
  // LinkedEditingRangeProvider es el motor súper optimizado que usa VS Code para renombramiento múltiple.
  const provider = vscode.languages.registerLinkedEditingRangeProvider(
    SUPPORTED_LANGUAGES,
    {
      provideLinkedEditingRanges(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.ProviderResult<vscode.LinkedEditingRanges> {
        const lineText = document.lineAt(position.line).text;
        const tagPattern = /<\/?[a-zA-Z0-9\-]+[^>]*>/g;
        let match;

        let tagName = '';
        let isClosing = false;
        let currentRange: vscode.Range | undefined;

        // 1. Identificar la etiqueta bajo el cursor en la línea actual
        while ((match = tagPattern.exec(lineText)) !== null) {
          const start = match.index;
          const end = start + match[0].length;

          if (position.character >= start && position.character <= end) {
            const tagInfo = parseTagInfo(match[0]);
            if (tagInfo) {
              tagName = tagInfo.name;
              isClosing = tagInfo.isClosing;

              // Si es una etiqueta auto-conclusiva, no tiene hermana
              if (SELF_CLOSING_TAGS.has(tagName.toLowerCase())) {
                return undefined;
              }

              const nameStart = isClosing ? start + 2 : start + 1;
              const nameEnd = nameStart + tagName.length;
              currentRange = new vscode.Range(
                position.line,
                nameStart,
                position.line,
                nameEnd,
              );
            }
            break;
          }
        }

        if (!tagName || !currentRange) {
          return undefined;
        }

        // 2. Buscar la etiqueta hermana en TODO el documento (manejo de anidamiento)
        const siblingRange = findSiblingTag(
          document,
          tagName,
          isClosing,
          currentRange,
        );

        if (siblingRange) {
          return new vscode.LinkedEditingRanges([currentRange, siblingRange]);
        }

        return undefined;
      },
    },
  );

  context.subscriptions.push(provider);
}

/**
 * Busca la etiqueta correspondiente (apertura si es cierre, cierre si es apertura).
 * Implementa un contador para saltar etiquetas anidadas con el mismo nombre.
 */
function findSiblingTag(
  document: vscode.TextDocument,
  tagName: string,
  isClosing: boolean,
  currentRange: vscode.Range,
): vscode.Range | undefined {
  const fullText = document.getText();
  // Usamos un lookahead (?=[\s/>]) para asegurar que el nombre de la etiqueta termine ahí
  // y no coincida con prefijos (ej: 'div' no debe coincidir con 'divider')
  const tagPattern = new RegExp(`</?${tagName}(?=[\\s/>])`, 'gi');
  let depth = 0;

  if (!isClosing) {
    // Buscar la etiqueta de cierre </tagName> hacia adelante
    const startOffset = document.offsetAt(currentRange.end);
    tagPattern.lastIndex = startOffset;
    let match;

    while ((match = tagPattern.exec(fullText)) !== null) {
      const matchText = fullText.substring(
        match.index,
        fullText.indexOf('>', match.index) + 1,
      );
      const isMatchClosing = matchText.startsWith('</');

      if (isMatchClosing) {
        if (depth === 0) {
          const matchStartPos = document.positionAt(match.index);
          return new vscode.Range(
            matchStartPos.translate(0, 2),
            matchStartPos.translate(0, 2 + tagName.length),
          );
        }
        depth--;
      } else {
        // Encontramos otra etiqueta de apertura del mismo tipo (anidamiento)
        // Ignoramos si es auto-conclusiva explícitamente <tag />
        if (!matchText.endsWith('/>')) {
          depth++;
        }
      }
    }
  } else {
    // Buscar la etiqueta de apertura <tagName> hacia atrás
    const startOffset = document.offsetAt(currentRange.start);
    const textBefore = fullText.substring(0, startOffset - 2); // -2 para quitar el "</"
    const allMatches = Array.from(textBefore.matchAll(tagPattern));

    for (let i = allMatches.length - 1; i >= 0; i--) {
      const match = allMatches[i];
      const matchIndex = match.index!;
      const matchText = fullText.substring(
        matchIndex,
        fullText.indexOf('>', matchIndex) + 1,
      );
      const isMatchClosing = matchText.startsWith('</');

      if (!isMatchClosing) {
        if (depth === 0) {
          const matchStartPos = document.positionAt(matchIndex);
          return new vscode.Range(
            matchStartPos.translate(0, 1),
            matchStartPos.translate(0, 1 + tagName.length),
          );
        }
        depth--;
      } else {
        depth++;
      }
    }
  }

  return undefined;
}

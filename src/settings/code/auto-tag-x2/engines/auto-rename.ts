import * as vscode from 'vscode';
import { SUPPORTED_LANGUAGES } from '../utils/config';
import { parseTagInfo, SELF_CLOSING_TAGS } from '../utils/document-utils';

export function registerAutoRename(context: vscode.ExtensionContext) {
  // LinkedEditingRangeProvider is the optimized engine used by VS Code for multi-rename.
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

        // 1. Identify the tag under the cursor on the current line
        while ((match = tagPattern.exec(lineText)) !== null) {
          const start = match.index;
          const end = start + match[0].length;

          if (position.character >= start && position.character <= end) {
            const tagInfo = parseTagInfo(match[0]);
            if (tagInfo) {
              tagName = tagInfo.name;
              isClosing = tagInfo.isClosing;

              // Exit if it's a self-closing tag
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

        // 2. Find the sibling tag (opening/closing pair)
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
 * Finds the corresponding tag (opening if closing, closing if opening).
 * Uses a counter to skip nested tags with the same name.
 */
function findSiblingTag(
  document: vscode.TextDocument,
  tagName: string,
  isClosing: boolean,
  currentRange: vscode.Range,
): vscode.Range | undefined {
  const fullText = document.getText();
  const tagPattern = new RegExp(`</?${tagName}(?=[\\s/>])`, 'gi');
  let depth = 0;

  if (!isClosing) {
    // Search forward for the closing tag
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
        // Nested opening tag
        if (!matchText.endsWith('/>')) {
          depth++;
        }
      }
    }
  } else {
    // Search backward for the opening tag
    const startOffset = document.offsetAt(currentRange.start);
    const textBefore = fullText.substring(0, startOffset - 2);
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

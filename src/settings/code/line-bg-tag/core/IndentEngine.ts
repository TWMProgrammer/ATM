import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { DecoratorManager } from '../ui/DecoratorManager';

/** Char codes for high-performance whitespace detection */
const CHAR_TAB = 9;
const CHAR_SPACE = 32;

export class IndentEngine {
  private config: ConfigManager;
  private decorator: DecoratorManager;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ConfigManager, decorator: DecoratorManager) {
    this.config = config;
    this.decorator = decorator;
  }

  /**
   * Triggers a debounced decoration update.
   * Uses configurable delay to prevent lag during rapid typing/scrolling.
   */
  public triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(
      () => this.updateDecorations(editor),
      this.config.updateDelay,
    );
  }

  /** Cancels any pending scheduled update */
  public cancelUpdate() {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Clears decorations from a specific editor without disposing types.
   */
  public clearAllDecorations(editor: vscode.TextEditor) {
    const empty: vscode.DecorationOptions[] = [];
    for (const dt of this.decorator.decorationTypes) {
      editor.setDecorations(dt, empty);
    }
    if (this.decorator.tabmixDecorationType) {
      editor.setDecorations(this.decorator.tabmixDecorationType, empty);
    }
  }

  /**
   * Core decoration engine.
   *
   * Performance strategy for large files:
   * - Only processes visible lines + dynamic buffer
   * - Zero regex in the hot loop (uses charCodeAt)
   * - Zero string allocations for indent calculation
   * - Reuses arrays via pre-allocation
   */
  private updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) {
      return;
    }

    const langId = editor.document.languageId;

    if (!this.config.isLanguageIncluded(langId)) {
      this.clearAllDecorations(editor);
      return;
    }

    const document = editor.document;
    const tabSizeRaw = editor.options.tabSize;
    const tabSize = tabSizeRaw === 'auto' ? 4 : Number(tabSizeRaw);
    const colorCount = this.config.colors.length;

    // Pre-allocate decoration arrays — one per color + error + tabmix
    const decorators: vscode.DecorationOptions[][] = new Array(colorCount);
    for (let i = 0; i < colorCount; i++) {
      decorators[i] = [];
    }
    const tabmixDecorator: vscode.DecorationOptions[] = [];

    const hasTabmix = this.decorator.tabmixDecorationType !== null;
    const hasIgnorePatterns = this.config.ignoreLinePatterns.length > 0;
    const colorOnWhiteSpaceOnly = this.config.colorOnWhiteSpaceOnly;

    // Visible ranges with dynamic buffer based on file size
    const visibleRanges = editor.visibleRanges;
    if (visibleRanges.length === 0) {
      return;
    }

    // Dynamic buffer: larger files get smaller buffer to prevent lag
    const lineCount = document.lineCount;
    const buffer = lineCount > 10000 ? 15 : lineCount > 3000 ? 20 : 30;

    for (const range of visibleRanges) {
      const startLine = Math.max(0, range.start.line - buffer);
      const endLine = Math.min(lineCount - 1, range.end.line + buffer);

      for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text;
        const textLength = text.length;

        // Skip truly empty lines
        if (textLength === 0) {
          continue;
        }

        // Fast whitespace prefix detection via charCodeAt (no regex needed)
        let wsEnd = 0;
        while (wsEnd < textLength) {
          const ch = text.charCodeAt(wsEnd);
          if (ch !== CHAR_SPACE && ch !== CHAR_TAB) {
            break;
          }
          wsEnd++;
        }

        // No leading whitespace → nothing to decorate
        if (wsEnd === 0) {
          continue;
        }

        // Check if the line should skip tabmix coloring based on ignore patterns
        let skip = false;

        if (hasIgnorePatterns) {
          const ignorePatterns = this.config.ignoreLinePatterns;
          const patternsLen = ignorePatterns.length;
          for (let i = 0; i < patternsLen; i++) {
            if (ignorePatterns[i].test(text)) {
              skip = true;
              break;
            }
          }
        }

        // Calculate indent width without creating any new strings
        // Tab = tabSize spaces, Space = 1 space
        let indentWidth = 0;
        for (let i = 0; i < wsEnd; i++) {
          indentWidth += text.charCodeAt(i) === CHAR_TAB ? tabSize : 1;
        }

        // Count tabs vs spaces for tabmix detection (only if feature enabled)
        let hasTabMix = false;
        if (!skip && hasTabmix) {
          let sawTab = false;
          let sawSpace = false;
          for (let i = 0; i < wsEnd; i++) {
            if (text.charCodeAt(i) === CHAR_TAB) {
              sawTab = true;
            } else {
              sawSpace = true;
            }
            if (sawTab && sawSpace) {
              hasTabMix = true;
              break; // Early exit
            }
          }
        }

        // Parse indent blocks positionally
        let charIndex = 0;
        let blockIndex = 0;

        while (charIndex < wsEnd) {
          const blockStart = charIndex;

          if (text.charCodeAt(charIndex) === CHAR_TAB) {
            charIndex++;
          } else {
            charIndex += tabSize;
          }

          // Clamp to whitespace boundary
          if (colorOnWhiteSpaceOnly && charIndex > wsEnd) {
            charIndex = wsEnd;
          }

          const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(
              lineIndex,
              blockStart,
              lineIndex,
              charIndex,
            ),
          };

          if (!skip && hasTabMix) {
            tabmixDecorator.push(decoration);
          } else {
            decorators[blockIndex % colorCount].push(decoration);
          }

          blockIndex++;
        }
      }
    }

    // Batch-apply decorations to VS Code renderer
    const decorationTypes = this.decorator.decorationTypes;
    for (let i = 0; i < decorationTypes.length; i++) {
      editor.setDecorations(decorationTypes[i], decorators[i]);
    }


    if (this.decorator.tabmixDecorationType) {
      editor.setDecorations(
        this.decorator.tabmixDecorationType,
        tabmixDecorator,
      );
    }
  }
}

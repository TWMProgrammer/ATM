import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { DecoratorManager } from '../ui/DecoratorManager';

export class IndentEngine {
  private config: ConfigManager;
  private decorator: DecoratorManager;
  private timeout: NodeJS.Timeout | null = null;

  constructor(config: ConfigManager, decorator: DecoratorManager) {
    this.config = config;
    this.decorator = decorator;
  }

  /**
   * Dispara una actualización con Debounce para evitar lags extremos
   * al escribir rápidamente o hacer mucho scroll.
   */
  public triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.timeout = setTimeout(
      () => this.updateDecorations(editor),
      this.config.updateDelay,
    );
  }

  /**
   * Cancela la actualización programada
   */
  public cancelUpdate() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  public clearAllDecorations(editor: vscode.TextEditor) {
    this.decorator.decorationTypes.forEach((dt) =>
      editor.setDecorations(dt, []),
    );
    if (this.decorator.errorDecorationType) {
      editor.setDecorations(this.decorator.errorDecorationType, []);
    }
    if (this.decorator.tabmixDecorationType) {
      editor.setDecorations(this.decorator.tabmixDecorationType, []);
    }
  }

  private updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) {
      return;
    }

    if (!this.isLanguageEnabled(editor)) {
      this.clearAllDecorations(editor);
      return;
    }

    const document = editor.document;
    const tabSizeRaw = editor.options.tabSize;
    const tabSize = tabSizeRaw === 'auto' ? 4 : Number(tabSizeRaw);

    const decorators: vscode.DecorationOptions[][] = this.config.colors.map(
      () => [],
    );
    const errorDecorator: vscode.DecorationOptions[] = [];
    const tabmixDecorator: vscode.DecorationOptions[] = [];

    const skipAllErrors = this.shouldSkipErrors(document.languageId);

    // Optimización 1: Procesar SOLO rangos visibles.
    // Esto es magia negra para el rendimiento: pasamos de O(TodoElArvhivo) a O(LíneasVisibles)
    const visibleRanges = editor.visibleRanges;
    if (visibleRanges.length === 0) {
      return;
    }

    for (const range of visibleRanges) {
      // Ampliar el rango en un "buffer" para prevenir ghosting visual durante el scroll rápido
      const startLine = Math.max(0, range.start.line - 30);
      const endLine = Math.min(document.lineCount - 1, range.end.line + 30);

      for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
        const line = document.lineAt(lineIndex);
        if (line.isEmptyOrWhitespace && line.text.length === 0) {
          continue;
        }

        const text = line.text;
        const match = text.match(/^[\t ]+/);

        if (!match) {
          continue;
        } // Si no hay espacios en blanco al inicio

        const whitespace = match[0];

        let skip = skipAllErrors;

        // Optimización 2: Búsqueda rápida y temprana de patrones a ignorar por línea,
        // y solo si hay alguna regla.
        if (!skip && this.config.ignoreLinePatterns.length > 0) {
          for (const regex of this.config.ignoreLinePatterns) {
            if (regex.test(text)) {
              skip = true;
              break;
            }
          }
        }

        const indentSpaces = whitespace.replace(
          /\t/g,
          ' '.repeat(tabSize),
        ).length;

        // Validar Errores de Identación (ej: indentación que no es múltiplo del tamaño de la tabulación)
        if (!skip && indentSpaces % tabSize !== 0) {
          const startPos = new vscode.Position(lineIndex, 0);
          const endPos = new vscode.Position(lineIndex, whitespace.length);
          errorDecorator.push({ range: new vscode.Range(startPos, endPos) });
        } else {
          // Procesar las indentaciones correctas
          let spaceCount = 0;
          let tabCount = 0;

          if (!skip && this.decorator.tabmixDecorationType) {
            for (let i = 0; i < whitespace.length; i++) {
              if (whitespace[i] === '\t') {
                tabCount++;
              } else if (whitespace[i] === ' ') {
                spaceCount++;
              }
            }
          }

          let n = 0;
          let o = 0;

          // Optimización 3: Parseo matemático basado puramente en index posicionales en vez de expresiones regulares y replace globales.
          while (n < whitespace.length) {
            const startPos = new vscode.Position(lineIndex, n);

            if (whitespace[n] === '\t') {
              n++;
            } else {
              n += tabSize;
            }

            if (this.config.colorOnWhiteSpaceOnly && n > whitespace.length) {
              n = whitespace.length;
            }

            const endPos = new vscode.Position(lineIndex, n);
            const decoration = { range: new vscode.Range(startPos, endPos) };

            if (
              !skip &&
              this.decorator.tabmixDecorationType &&
              spaceCount > 0 &&
              tabCount > 0
            ) {
              tabmixDecorator.push(decoration);
            } else {
              const decoListIndex = o % decorators.length;
              decorators[decoListIndex].push(decoration);
            }

            o++;
          }
        }
      }
    }

    // Aplicar los colores a la GUI de VSCode en lote
    this.decorator.decorationTypes.forEach((decorationType, index) => {
      editor.setDecorations(decorationType, decorators[index]);
    });

    if (this.decorator.errorDecorationType) {
      editor.setDecorations(this.decorator.errorDecorationType, errorDecorator);
    }

    if (this.decorator.tabmixDecorationType) {
      editor.setDecorations(
        this.decorator.tabmixDecorationType,
        tabmixDecorator,
      );
    }
  }

  private isLanguageEnabled(editor: vscode.TextEditor): boolean {
    const langId = editor.document.languageId;

    if (
      this.config.includedLanguages.length > 0 &&
      !this.config.includedLanguages.includes(langId)
    ) {
      return false;
    }
    if (
      this.config.excludedLanguages.length > 0 &&
      this.config.excludedLanguages.includes(langId)
    ) {
      return false;
    }
    return true;
  }

  private shouldSkipErrors(langId: string): boolean {
    if (this.config.ignoreErrorLanguages.length === 0) {
      return false;
    }
    if (
      this.config.ignoreErrorLanguages.includes('*') ||
      this.config.ignoreErrorLanguages.includes(langId)
    ) {
      return true;
    }
    return false;
  }
}

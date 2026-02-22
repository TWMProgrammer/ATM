import * as vscode from 'vscode';
import { defaultTags, CommentTag } from '../ui/styles';
import { Decorator } from '../ui/decorator';
import { getLanguageConfig } from './languages';

export class CommentsCodeController {
  private timeout: NodeJS.Timeout | undefined;
  private decorator: Decorator;

  constructor() {
    this.decorator = new Decorator();
    this.decorator.initializeTags(defaultTags);
  }

  public triggerUpdateDecorations(
    document: vscode.TextDocument,
    immediate = false,
  ) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    if (immediate) {
      this.updateDecorations(document);
    } else {
      // Debounce para evitar lag de escritura (300ms)
      this.timeout = setTimeout(() => this.updateDecorations(document), 300);
    }
  }

  private updateDecorations(document: vscode.TextDocument) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document !== document) {
      return;
    }

    const langConfig = getLanguageConfig(document.languageId);
    if (!langConfig) {
      return; // Lenguaje no soportado (json, texto, etc... si no tienen comentarios)
    }

    // Regex para buscar los "tags" dentro del documento
    const tags = defaultTags;
    // Agrupamos en Regex con boundaries \b, o al principio de espacio

    // Diccionarios con los rangos a decorar (clave: texto del tag)
    const rangesToDecorate = new Map<string, vscode.DecorationOptions[]>();
    tags.forEach((t) => rangesToDecorate.set(t.text, []));

    // Solo procesar las líneas visibles (para máximo rendimiento)
    const visibleRanges = activeEditor.visibleRanges;

    // Buffer extra de líneas hacia arriba y abajo para que el scroll suave no pierda los colores
    const extraLines = 50;

    for (const visibleRange of visibleRanges) {
      const startLine = Math.max(0, visibleRange.start.line - extraLines);
      const endLine = Math.min(
        document.lineCount - 1,
        visibleRange.end.line + extraLines,
      );

      for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        // 1. Validar si hay un inicio de comentario single-line
        const slIdx = langConfig.singleLine
          ? text.indexOf(langConfig.singleLine)
          : -1;

        if (slIdx !== -1) {
          // Es un comentario! Buscamos un tag aplicable en el texto posterior
          const commentContent = text.substring(
            slIdx + langConfig.singleLine!.length,
          );
          const trimmingOffset =
            commentContent.length - commentContent.trimStart().length;

          let matchedTag: CommentTag | undefined;
          let matchedIndex = -1;

          for (const tag of tags) {
            // Un tag coincide si el texto del comentario (sin espacios extra) empieza con el tag (para line) o lo contiene (para word)
            const targetText = commentContent.trimStart();
            if (targetText.startsWith(tag.text)) {
              matchedTag = tag;
              // slIdx + delta original + trimming offset.
              matchedIndex =
                slIdx + langConfig.singleLine!.length + trimmingOffset;
              break;
            }
          }

          if (matchedTag) {
            const startPos = new vscode.Position(i, matchedIndex);
            // Si es 'line', pintarlo hasta el final. Si es 'word', pintarlo hasta la longitud del tag.
            const endPos =
              matchedTag.type === 'line'
                ? new vscode.Position(i, text.length)
                : new vscode.Position(i, matchedIndex + matchedTag.text.length);

            rangesToDecorate
              .get(matchedTag.text)
              ?.push({ range: new vscode.Range(startPos, endPos) });
            continue; // ir a la siguiente línea
          }
        }

        // Search for 'word' tags (TODO, FIXME, NOTE) but ONLY inside detected comment regions.
        // This avoids false positives in string literals or variable names.
        const commentStart = slIdx !== -1 ? slIdx : -1;
        if (commentStart !== -1) {
          const commentText = text.substring(commentStart);
          for (const tag of tags) {
            if (tag.type === 'word') {
              let searchFrom = 0;
              while (searchFrom < commentText.length) {
                const matchIdx = commentText.indexOf(tag.text, searchFrom);
                if (matchIdx === -1) {
                  break;
                }

                // Word boundary check: char before and after must not be alphanumeric or '_'
                const before = matchIdx > 0 ? commentText[matchIdx - 1] : ' ';
                const after = commentText[matchIdx + tag.text.length] ?? ' ';
                const isWordBoundary =
                  !/[\w]/.test(before) && !/[\w]/.test(after);

                if (isWordBoundary) {
                  const absIdx = commentStart + matchIdx;
                  const startPos = new vscode.Position(i, absIdx);
                  const endPos = new vscode.Position(
                    i,
                    absIdx + tag.text.length,
                  );
                  const exists = rangesToDecorate
                    .get(tag.text)
                    ?.some(
                      (r) => r.range.start.character === startPos.character,
                    );
                  if (!exists) {
                    rangesToDecorate
                      .get(tag.text)
                      ?.push({ range: new vscode.Range(startPos, endPos) });
                  }
                }
                searchFrom = matchIdx + tag.text.length;
              }
            }
          }
        }

        // TODO: Agregar soporte a block comments /* */
      }
    }

    this.decorator.applyDecorations(activeEditor, rangesToDecorate);
  }

  public listAnnotations() {
    vscode.window.showInformationMessage(
      'List annotations command executing! (Placeholder for global workspace search)',
    );
  }

  public dispose() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.decorator.dispose();
  }
}

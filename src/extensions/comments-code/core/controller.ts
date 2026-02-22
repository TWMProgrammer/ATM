import * as vscode from 'vscode';
import { defaultTags, CommentTag } from './config';
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

    // Solo procesar las lineas visibles (para MAXIMO rendimiento)
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

        // TODO: Agregar soporte si el color "word" (como TODO) no requiere de empezar con un comentario. O se quiere buscar en cualquier lugar.
        // todo-highlight originalmente busca el Regex en TODOS lados de la linea:
        for (const tag of tags) {
          if (tag.type === 'word') {
            let matchIdx = text.indexOf(tag.text); // simplificado, para regex sería con exec
            if (matchIdx !== -1) {
              // validamos que sea "Word" puro y no parte de otra palabra (opcional)
              const endIdx = matchIdx + tag.text.length;
              const startPos = new vscode.Position(i, matchIdx);
              const endPos = new vscode.Position(i, endIdx);
              // Lo agregamos (evitamos duplicar si ya estaba antes anotado arriba)
              const exists = rangesToDecorate
                .get(tag.text)
                ?.some((r) => r.range.start.character === startPos.character);
              if (!exists) {
                rangesToDecorate
                  .get(tag.text)
                  ?.push({ range: new vscode.Range(startPos, endPos) });
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
    }
  }
}

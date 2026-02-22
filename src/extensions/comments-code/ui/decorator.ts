import * as vscode from 'vscode';
import { CommentTag } from './styles';

export class Decorator {
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

  /**
   * Initializes TextEditorDecorationType objects based on loaded tags.
   */
  public initializeTags(tags: CommentTag[]) {
    // Clear old if needed
    for (const dec of this.decorationTypes.values()) {
      dec.dispose();
    }
    this.decorationTypes.clear();

    for (const tag of tags) {
      const options: vscode.DecorationRenderOptions = {
        color: tag.color,
        backgroundColor: tag.backgroundColor,
      };

      if (tag.strikethrough) {
        options.textDecoration = 'line-through';
      }

      if (tag.fontWeight) {
        options.fontWeight = tag.fontWeight;
      }

      // Add overview ruler markers (colored dots on the scrollbar)
      if (tag.type === 'word' && tag.backgroundColor) {
        options.overviewRulerLane = vscode.OverviewRulerLane.Right;
        options.overviewRulerColor = tag.backgroundColor;
      } else if (tag.type === 'line' && tag.color) {
        options.overviewRulerLane = vscode.OverviewRulerLane.Right;
        options.overviewRulerColor = tag.color;
      }

      const decoration = vscode.window.createTextEditorDecorationType(options);
      this.decorationTypes.set(tag.text, decoration);
    }
  }

  /**
   * Applies all calculated ranges to the active editor.
   */
  public applyDecorations(
    editor: vscode.TextEditor,
    ranges: Map<string, vscode.DecorationOptions[]>,
  ) {
    for (const [tagText, decType] of this.decorationTypes.entries()) {
      const r = ranges.get(tagText) || [];
      editor.setDecorations(decType, r);
    }
  }

  public dispose() {
    for (const dec of this.decorationTypes.values()) {
      dec.dispose();
    }
    this.decorationTypes.clear();
  }
}

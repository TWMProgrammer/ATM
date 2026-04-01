import * as vscode from 'vscode';
import { CommentTag } from './styles';

export class Decorator {
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

  /**
   * Initializes TextEditorDecorationType objects based on loaded tags.
   */
  public initializeTags(tags: CommentTag[]) {
    // Clear existing decoration types if needed
    for (const dec of this.decorationTypes.values()) {
      dec.dispose();
    }
    this.decorationTypes.clear();

    for (const tag of tags) {
      const options: vscode.DecorationRenderOptions = {
        color: tag.color,
        backgroundColor: tag.backgroundColor,
      };

      // OPTION 1: "Whole Line" highlighted
      if (tag.type === 'line') {
        options.isWholeLine = true;
        
        // If it doesn't have an explicit backgroundColor, derive from main color
        if (!options.backgroundColor && tag.color) {
          let baseColor = tag.color;
          // If color has alpha channel (e.g. #3297fbff), strip it
          if (baseColor.length === 9) {
            baseColor = baseColor.slice(0, 7);
          }
          // Add highly transparent alpha channel (e.g., 22 = ~13% opacity)
          options.backgroundColor = baseColor + '22';
        }
      }

      if (tag.strikethrough) {
        options.textDecoration = 'line-through';
      }

      if (tag.fontWeight) {
        options.fontWeight = tag.fontWeight;
      }

      if (tag.fontStyle) {
        options.fontStyle = tag.fontStyle;
      }

      // OPTION 2: "Word" highlighted tags (Badges)
      if (tag.type === 'word') {
        options.borderRadius = '3px';
      }

      // Add overview ruler markers on the scrollbar (scroll line)
      if (tag.type === 'word' && tag.backgroundColor) {
        // Use 'Full' lane for word tags (TODO, FIXME, MARK) to make them more striking!
        options.overviewRulerLane = vscode.OverviewRulerLane.Full;
        options.overviewRulerColor = tag.backgroundColor;
      } else if (tag.type === 'line' && tag.color) {
        // Normal lane (Right) for line annotations (~, !, etc.)
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

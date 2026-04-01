import * as vscode from 'vscode';
import { CommentTag } from './styles';

function getSvgDataUri(iconType: string | undefined, color: string | undefined): vscode.Uri | undefined {
  if (!iconType) return undefined;
  const baseColor = color ? (color.length === 9 ? color.slice(0, 7) : color) : '#ffffff';
  let d = '';
  switch (iconType) {
    case 'alert':
    case 'fixme':
        d = "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM7.5 11h1v1h-1v-1zM7.5 5h1v5h-1V5z";
        break;
    case 'todo':
    case 'note':
        d = "M13.71 4.71L12.3 3.3l-5.65 5.66-2.95-2.95-1.41 1.41 4.36 4.36 7.06-7.07z"; 
        break;
    case 'mark':
        d = "M3 2v13l5-3.33L13 15V2H3zm1 1h8v9.75l-4-2.67-4 2.67V3z";
        break;
    case 'question':
        d = "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM7.74 12h1.02v-1.22H7.74V12zm.49-8.49c-.83 0-1.48.47-1.48 1.48v.3h.8v-.25c0-.42.27-.68.68-.68.44 0 .7.26.7.68 0 .5-.47.66-.99 1.1-.38.31-.69.83-.69 1.41v.37h.85v-.42c0-.41.27-.67.7-.97.43-.31.86-.68.86-1.47 0-1.01-.63-1.55-1.43-1.55z";
        break;
    default:
        d = "M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"; // simple dot
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="${baseColor}" fill-rule="evenodd" d="${d}"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

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

      // Gutter Icon
      if (tag.gutterIcon) {
        // Prefer backgroundColor for word tags, fallback to primary color
        const iconColor = tag.backgroundColor || tag.color;
        const uri = getSvgDataUri(tag.gutterIcon, iconColor);
        if (uri) {
           options.gutterIconPath = uri;
           options.gutterIconSize = 'contain';
        }
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

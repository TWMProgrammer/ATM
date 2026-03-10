import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';

export class DecoratorManager {
  public decorationTypes: vscode.TextEditorDecorationType[] = [];
  public errorDecorationType: vscode.TextEditorDecorationType | null = null;
  public tabmixDecorationType: vscode.TextEditorDecorationType | null = null;
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
    this.buildDecorations();
  }

  /**
   * Rebuilds all decoration types from the current config.
   * Always disposes existing decorations first to prevent memory leaks.
   */
  public buildDecorations() {
    this.disposeAll();

    const { colors, indicatorStyle, lineWidth, errorColor, tabmixColor } =
      this.config;

    for (const color of colors) {
      const style: vscode.DecorationRenderOptions =
        indicatorStyle === 'light'
          ? {
              borderStyle: 'solid',
              borderColor: color,
              borderWidth: `0 0 0 ${lineWidth}px`,
            }
          : { backgroundColor: color };

      this.decorationTypes.push(
        vscode.window.createTextEditorDecorationType(style),
      );
    }

    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: errorColor,
    });

    if (tabmixColor) {
      this.tabmixDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: tabmixColor,
      });
    }
  }

  /**
   * Clears decorations from all visible editors without disposing types.
   * Use when temporarily hiding decorations (e.g., language not supported).
   */
  public clearFromEditors(editors: readonly vscode.TextEditor[]) {
    const empty: vscode.DecorationOptions[] = [];
    for (const editor of editors) {
      for (const dt of this.decorationTypes) {
        editor.setDecorations(dt, empty);
      }
      if (this.errorDecorationType) {
        editor.setDecorations(this.errorDecorationType, empty);
      }
      if (this.tabmixDecorationType) {
        editor.setDecorations(this.tabmixDecorationType, empty);
      }
    }
  }

  /**
   * Disposes all TextEditorDecorationType instances to free memory.
   * Must be called on deactivation and before rebuilding decorations.
   */
  public disposeAll() {
    for (const dt of this.decorationTypes) {
      dt.dispose();
    }
    this.decorationTypes = [];

    if (this.errorDecorationType) {
      this.errorDecorationType.dispose();
      this.errorDecorationType = null;
    }
    if (this.tabmixDecorationType) {
      this.tabmixDecorationType.dispose();
      this.tabmixDecorationType = null;
    }
  }
}

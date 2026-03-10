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

  public buildDecorations() {
    // Limpiar decoraciones anteriores
    this.clearDecorations();

    // Recrear decoraciones basadas en la configuración
    this.config.colors.forEach((color) => {
      if (this.config.indicatorStyle === 'classic') {
        this.decorationTypes.push(
          vscode.window.createTextEditorDecorationType({
            backgroundColor: color,
          }),
        );
      } else if (this.config.indicatorStyle === 'light') {
        this.decorationTypes.push(
          vscode.window.createTextEditorDecorationType({
            borderStyle: 'solid',
            borderColor: color,
            borderWidth: `0 0 0 ${this.config.lineWidth}px`,
          }),
        );
      }
    });

    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: this.config.errorColor,
    });

    if (this.config.tabmixColor !== '') {
      this.tabmixDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: this.config.tabmixColor,
      });
    }
  }

  public clearDecorations() {
    this.decorationTypes.forEach((dt) => dt.dispose());
    this.decorationTypes = [];
    if (this.errorDecorationType) {
      this.errorDecorationType.dispose();
    }
    if (this.tabmixDecorationType) {
      this.tabmixDecorationType.dispose();
    }
  }
}

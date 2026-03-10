import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';

export class NativeEnhancements {
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  /**
   * Applies native VS Code enhancements if the user hasn't explicitly set them.
   * This provides a "ready-to-use" experience out of the box.
   */
  public apply() {
    if (!this.config.applyNativeEnhancements) {
      return;
    }

    const editorConfig = vscode.workspace.getConfiguration('editor');

    // 1. Bracket Pairs - Highlight only the active pair
    this.safeUpdate(editorConfig, 'guides.bracketPairs', 'active');

    // 2. Bracket Pair Colorization - Enable for clear hierarchical view
    this.safeUpdate(editorConfig, 'bracketPairColorization.enabled', true);

    // 3. Render Whitespace - Show all (dots always visible)
    this.safeUpdate(editorConfig, 'renderWhitespace', 'all');

    // 4. Indentation Guides - Enable clean native guides
    this.safeUpdate(editorConfig, 'guides.indentation', true);

    // 5. Active Indentation - Highlight the current level
    this.safeUpdate(editorConfig, 'guides.highlightActiveIndentation', true);
  }

  /**
   * Updates a setting only if it's currently at its default value
   * (meaning the user hasn't manually overridden it).
   */
  private async safeUpdate(
    config: vscode.WorkspaceConfiguration,
    key: string,
    value: any,
  ) {
    const info = config.inspect(key);

    // If there's no globalValue, workspaceValue, or workspaceFolderValue,
    // it means it's still at the default.
    const isDefault =
      info?.globalValue === undefined &&
      info?.workspaceValue === undefined &&
      info?.workspaceFolderValue === undefined;

    if (isDefault) {
      try {
        await config.update(key, value, vscode.ConfigurationTarget.Global);
      } catch (err) {
        console.error(`Failed to apply native enhancement for ${key}:`, err);
      }
    }
  }
}

import * as vscode from 'vscode';

const SECTION = 'atm.image.preview';

type ConfigKey =
  | 'sourceFolder'
  | 'sourceFolders'
  | 'imagePreviewMaxHeight'
  | 'imagePreviewMaxWidth'
  | 'showImagePreviewOnGutter'
  | 'showUnderline'
  | 'currentColorForSVG';

/**
 * Reads a configuration property scoped to the given document.
 */
export function getConfig<T>(document: vscode.TextDocument | undefined, key: ConfigKey, fallback: T): T {
  const config = vscode.workspace.getConfiguration(SECTION, document?.uri);
  return config.get<T>(key, fallback);
}

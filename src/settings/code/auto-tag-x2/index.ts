import * as vscode from 'vscode';
import { activateAutoTagFeatures as activateNative } from './native/active';
import { deactivateAutoTagFeatures as deactivateNative } from './native/desactive';
import { registerAutoClose } from './engines/auto-close';
import { registerAutoRename } from './engines/auto-rename';

/**
 * Activates auto-close and auto-rename features for HTML/XML and Markdown.
 */
export function activateAutoTagFeatures(context: vscode.ExtensionContext) {
  activateNative();

  registerAutoClose(context);
  registerAutoRename(context);
}

export function deactivateAutoTagFeatures() {
  deactivateNative();
}

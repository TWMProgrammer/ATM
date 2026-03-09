import * as vscode from 'vscode';
import { activateAutoTagFeatures as activateNative } from './native/active';
import { deactivateAutoTagFeatures as deactivateNative } from './native/desactive';
import { registerAutoClose } from './engines/auto-close';
import { registerAutoRename } from './engines/auto-rename';

/**
 * Activa los motores de autocompletado y renombrado para HTML/XML en todo el entorno,
 * y lanza los motores personalizados para Markdown en simultáneo.
 */
export function activateAutoTagFeatures(context: vscode.ExtensionContext) {
  // 1. Activa las configuraciones globales nativas (LinkedEditing general, Markdown overrides)
  activateNative();

  // 2. Registra nuestros motores optimizados y puros para lenguajes sin soporte
  registerAutoClose(context);
  registerAutoRename(context);
}

export function deactivateAutoTagFeatures() {
  deactivateNative();
}

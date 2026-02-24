import * as vscode from 'vscode';
import { translateText } from './core/translator';
import { showLanguageQuickPick } from './ui/quickPick';
import { TranslatorWebviewPanel } from './ui/webview';

export function activateMarkdownSee(context: vscode.ExtensionContext) {
  // Command to trigger the translation
  const translateCmd = vscode.commands.registerCommand('atm.markdown-see.translateExtension', async (arg?: any) => {
    // 1. Get the target text
    let targetText = "";

    // Check if invoked from Extension Context Menu (Option C)
    if (arg && arg.id) {
        // It provides the extension identifier, e.g., 'bastndev.lynx-theme'
        const extension = vscode.extensions.getExtension(arg.id);
        if (extension) {
            try {
                const readmeUri = vscode.Uri.joinPath(extension.extensionUri, 'README.md');
                const readmeData = await vscode.workspace.fs.readFile(readmeUri);
                targetText = Buffer.from(readmeData).toString('utf8');
            } catch (e) {
                try {
                    // Try lowercase if uppercase fails
                    const readmeUri = vscode.Uri.joinPath(extension.extensionUri, 'readme.md');
                    const readmeData = await vscode.workspace.fs.readFile(readmeUri);
                    targetText = Buffer.from(readmeData).toString('utf8');
                } catch (e2) {
                    vscode.window.showErrorMessage(`No se pudo encontrar el README en la extensión: \${arg.id}`);
                    return;
                }
            }
        } else {
            vscode.window.showInformationMessage(`Para traducir \${arg.id}, primero debes tener la extensión instalada.`);
            return;
        }
    } else {
        // Default behavior: try to get text from active text editor first
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          targetText = editor.document.getText(editor.selection);
          if (!targetText) {
            targetText = editor.document.getText();
          }
        }

        // If we are in the extension webview, activeTextEditor is undefined.
        // Let's forcibly trigger a copy command to get whatever the user has highlighted.
        if (!targetText) {
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            // Small delay to ensure clipboard is populated
            await new Promise(resolve => setTimeout(resolve, 100));
            targetText = await vscode.env.clipboard.readText();
        }

        if (!targetText) {
            vscode.window.showInformationMessage('No hay texto seleccionado, asegúrate de presionar Ctrl+C o click derecho -> Copiar antes de traducir.');
            return;
        }
    }

    // 2. Select language
    const lang = await showLanguageQuickPick();
    if (!lang) { return; }

    // 3. Open Webview with Skeleton
    const panel = TranslatorWebviewPanel.createOrShow(context.extensionUri);
    panel.setSkeleton();

    // 4. Translate text
    try {
      const translated = await translateText(targetText, lang.code);
      
      // 5. Render translated text
      panel.setTranslatedMarkdown(translated);
    } catch (e: any) {
      vscode.window.showErrorMessage('Translation failed: ' + e.message);
      panel.setError('Translation failed. Please try again.');
    }
  });

  context.subscriptions.push(translateCmd);
}

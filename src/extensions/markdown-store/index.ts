import * as vscode from 'vscode';
import { translateText } from './core/translator';
import { showLanguageQuickPick } from './ui/quickPick';
import { TranslatorWebviewPanel } from './ui/webview';
import type { TranslationTarget } from './ui/webview';

/* =========================================================
 * 🧠 IN-MEMORY TRANSLATION CACHE
 * Lives only while VS Code is open
 * Key: "textLength:langCode" — Value: translated text
 * ========================================================= */
const translationCache = new Map<string, string>();

function cacheKey(text: string, langCode: string): string {
  return `${text.length}:${langCode}`;
}

export function activateMarkdownStore(context: vscode.ExtensionContext) {
  const translateCmd = vscode.commands.registerCommand('atm.markdown-store.translateExtension', async (arg?: any) => {
    let targetText = '';
    let detectedExt: vscode.Extension<any> | undefined;

    if (arg && arg.id) {
      // Invoked from the extension context menu (right-click) — ID is provided
      const ext = vscode.extensions.getExtension(arg.id);
      if (ext) {
        detectedExt = ext;
        targetText = await readExtensionReadme(ext);
        if (!targetText) { return; }
      } else {
        vscode.window.showInformationMessage(`To translate "${arg.id}", the extension must be installed first.`);
        return;
      }
    } else {
      // Invoked from the title-bar globe icon — try to detect the extension automatically
      const detected = detectExtensionFromActiveTab();
      if (detected) {
        detectedExt = detected;
        targetText = await readExtensionReadme(detected);
        if (!targetText) { return; }
      } else {
        // Fallback: use the active text editor content
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          targetText = editor.document.getText(editor.selection) || editor.document.getText();
        }

        if (!targetText) {
          vscode.window.showInformationMessage(
            'Could not detect the extension. Right-click on an extension and select "Translate Extension README".'
          );
          return;
        }
      }
    }

    // Select target language
    const lang = await showLanguageQuickPick();
    if (!lang) { return; }

    // Build translation target info for the webview
    const target: TranslationTarget = {
      extensionUri: detectedExt?.extensionUri,
      displayName: detectedExt?.packageJSON?.displayName,
      iconRelativePath: detectedExt?.packageJSON?.icon,
      languageLabel: lang.label,
    };

    // Open webview with loading skeleton
    const panel = TranslatorWebviewPanel.createOrShow(context.extensionUri, target);

    // Translate and render (with cache)
    await translateAndRender(panel, targetText, lang.code);
  });

  context.subscriptions.push(translateCmd);
}

// =========================================================
// 🔄 TRANSLATE + RENDER HELPER (USES CACHE)
// =========================================================

async function translateAndRender(
  panel: TranslatorWebviewPanel,
  text: string,
  langCode: string
): Promise<void> {
  const key = cacheKey(text, langCode);

  // Check cache first — instant render
  const cached = translationCache.get(key);
  if (cached) {
    panel.setTranslatedMarkdown(cached);
    return;
  }

  // Not cached — show skeleton and translate
  panel.setSkeleton();

  try {
    const translated = await translateText(text, langCode);

    if (panel.isDisposed) { return; }

    translationCache.set(key, translated);
    panel.setTranslatedMarkdown(translated);
  } catch (e: any) {
    if (panel.isDisposed) { return; }
    vscode.window.showErrorMessage('Translation failed: ' + e.message);
    panel.setError('Translation failed. Please try again.');
  }
}


// =========================================================
// 🛠️ HELPERS
// =========================================================

/**
 * Try multiple casing variants of README.md to find the file.
 */
async function readExtensionReadme(ext: vscode.Extension<any>): Promise<string> {
  const candidates = ['README.md', 'readme.md', 'Readme.md', 'ReadMe.md'];

  for (const name of candidates) {
    try {
      const uri = vscode.Uri.joinPath(ext.extensionUri, name);
      const data = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(data).toString('utf8');
    } catch { /* try next candidate */ }
  }

  vscode.window.showErrorMessage('Could not find a README file in this extension.');
  return '';
}

/**
 * Detect which extension the user is currently viewing by matching the
 * active tab label ("Extension: <DisplayName>") against all installed
 * extensions.
 */
function detectExtensionFromActiveTab(): vscode.Extension<any> | undefined {
  const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
  if (!activeTab) { return undefined; }

  const label = activeTab.label;

  // VS Code extension pages have tabs labelled "Extension: Display Name"
  if (!label.startsWith('Extension:')) { return undefined; }

  const displayName = label.substring('Extension:'.length).trim();
  const lower = displayName.toLowerCase();

  // Single-pass: exact match returns immediately, case-insensitive kept as fallback
  let fallback: vscode.Extension<any> | undefined;

  for (const ext of vscode.extensions.all) {
    const name = ext.packageJSON?.displayName;
    if (!name) { continue; }

    if (name === displayName) { return ext; }
    if (!fallback && name.toLowerCase() === lower) { fallback = ext; }
  }

  return fallback;
}

/**
 * Clean up the webview panel when the extension is deactivated.
 */
export function deactivateMarkdownStore(): void {
  TranslatorWebviewPanel.currentPanel?.dispose();
}

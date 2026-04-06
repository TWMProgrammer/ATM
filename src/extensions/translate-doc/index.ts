import * as vscode from 'vscode';
import { fetchReleaseNotesMarkdown, preprocessReleaseNotesMarkdown, detectVersionFromReleaseNotesTab, registerReleaseNotesContextTracking } from './core/releaseNotes';
import { translateText } from './core/translator';
import { showLanguageQuickPick } from './ui/quickPick';
import { TranslatorWebviewPanel } from './ui/webview';
import type { TranslationTarget } from './ui/webview';

const translationCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 20;

const COMMANDS = {
  translateExtension: 'atm.translate-doc.translateExtension',
  translateReleaseNotes: 'atm.translate-doc.translateReleaseNotes',
  legacyTranslateExtension: 'atm.markdown-store.translateExtension',
  legacyTranslateReleaseNotes: 'atm.release-notes.translate',
};

function cacheKey(text: string, langCode: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `${hash}:${text.length}:${langCode}`;
}

export function activateTranslateDoc(context: vscode.ExtensionContext): void {
  registerReleaseNotesContextTracking(context);

  const translateExtensionHandler = async (arg?: any) => {
    let targetText = '';
    let detectedExt: vscode.Extension<any> | undefined;

    if (arg && arg.id) {
      const ext = vscode.extensions.getExtension(arg.id);
      if (!ext) {
        vscode.window.showInformationMessage(`To translate "${arg.id}", the extension must be installed first.`);
        return;
      }

      detectedExt = ext;
      targetText = await readExtensionReadme(ext);
      if (!targetText) {
        return;
      }
    } else {
      const detected = detectExtensionFromActiveTab();
      if (detected) {
        detectedExt = detected;
        targetText = await readExtensionReadme(detected);
        if (!targetText) {
          return;
        }
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          targetText = editor.document.getText(editor.selection) || editor.document.getText();
        }

        if (!targetText) {
          vscode.window.showInformationMessage(
            'First, install the extension 😉 and then start translating.'
          );
          return;
        }
      }
    }

    const lang = await showLanguageQuickPick();
    if (!lang) {
      return;
    }

    const target: TranslationTarget = {
      extensionUri: detectedExt?.extensionUri,
      displayName: detectedExt?.packageJSON?.displayName,
      iconRelativePath: detectedExt?.packageJSON?.icon,
      languageLabel: lang.label,
    };

    const panel = TranslatorWebviewPanel.createOrShow(context.extensionUri, target);
    await translateAndRender(panel, targetText, lang.code);
  };

  const translateReleaseNotesHandler = async () => {
    const versionInfo = detectVersionFromReleaseNotesTab();
    if (!versionInfo) {
      vscode.window.showInformationMessage('Please open the VS Code Release Notes tab first.');
      return;
    }

    const lang = await showLanguageQuickPick();
    if (!lang) {
      return;
    }

    const target: TranslationTarget = {
      displayName: `VS Code ${versionInfo.version} Notes`,
      languageLabel: lang.label,
    };

    const panel = TranslatorWebviewPanel.createOrShow(context.extensionUri, target);
    panel.setSkeleton();

    try {
      const markdown = await fetchReleaseNotesMarkdown(versionInfo.version);
      if (!markdown) {
        throw new Error('Could not fetch the release notes content.');
      }

      const cleanMarkdown = preprocessReleaseNotesMarkdown(markdown, lang.code);
      await translateAndRender(panel, cleanMarkdown, lang.code);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to translate Release Notes: ${error.message}`);
      panel.setError('Could not load or translate the release notes. Please check your connection.');
    }
  };

  context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.translateExtension, translateExtensionHandler));
  context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.translateReleaseNotes, translateReleaseNotesHandler));

  // Backward-compatible aliases for existing user keybindings/workflows.
  context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.legacyTranslateExtension, translateExtensionHandler));
  context.subscriptions.push(vscode.commands.registerCommand(COMMANDS.legacyTranslateReleaseNotes, translateReleaseNotesHandler));
}

async function translateAndRender(panel: TranslatorWebviewPanel, text: string, langCode: string): Promise<void> {
  const key = cacheKey(text, langCode);
  const cached = translationCache.get(key);
  if (cached) {
    panel.setTranslatedMarkdown(cached);
    return;
  }

  panel.setSkeleton();

  const controller = new AbortController();

  try {
    const translated = await translateText(text, langCode, controller.signal);
    if (panel.isDisposed) {
      controller.abort();
      return;
    }

    if (translationCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = translationCache.keys().next().value;
      if (oldest !== undefined) { translationCache.delete(oldest); }
    }
    translationCache.set(key, translated);
    panel.setTranslatedMarkdown(translated);
  } catch (error: any) {
    controller.abort();
    if (panel.isDisposed) {
      return;
    }

    vscode.window.showErrorMessage('Translation failed: ' + error.message);
    panel.setError('Translation failed. Please try again.');
  }
}

async function readExtensionReadme(ext: vscode.Extension<any>): Promise<string> {
  const candidates = ['README.md', 'readme.md', 'Readme.md', 'ReadMe.md'];

  for (const name of candidates) {
    try {
      const uri = vscode.Uri.joinPath(ext.extensionUri, name);
      const data = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(data).toString('utf8');
    } catch {
      // Try next candidate.
    }
  }

  vscode.window.showErrorMessage('Could not find a README file in this extension.');
  return '';
}

function detectExtensionFromActiveTab(): vscode.Extension<any> | undefined {
  const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
  if (!activeTab) {
    return undefined;
  }

  const label = activeTab.label;
  if (!label.startsWith('Extension:')) {
    return undefined;
  }

  const displayName = label.substring('Extension:'.length).trim();
  const lower = displayName.toLowerCase();

  let fallback: vscode.Extension<any> | undefined;

  for (const ext of vscode.extensions.all) {
    const name = ext.packageJSON?.displayName;
    if (!name) {
      continue;
    }

    if (name === displayName) {
      return ext;
    }

    if (!fallback && name.toLowerCase() === lower) {
      fallback = ext;
    }
  }

  return fallback;
}

export function deactivateTranslateDoc(): void {
  TranslatorWebviewPanel.currentPanel?.dispose();
}

import * as https from 'https';
import * as vscode from 'vscode';

interface ReleaseNotesFetchResult {
  markdown: string;
}

export function registerReleaseNotesContextTracking(context: vscode.ExtensionContext): void {
  const updateReleaseNotesContext = () => {
    const isActive = isReleaseNotesTab(vscode.window.tabGroups?.activeTabGroup?.activeTab);
    void vscode.commands.executeCommand('setContext', 'atm.releaseNotes.active', isActive);
  };

  updateReleaseNotesContext();
  context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(updateReleaseNotesContext));
  context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabGroups(updateReleaseNotesContext));
}

export function detectVersionFromReleaseNotesTab(): { version: string } | undefined {
  const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
  if (!activeTab || !isReleaseNotesTab(activeTab)) {
    return undefined;
  }

  const label = activeTab.label;
  const match = label.match(/\d+\.\d+(?:\.\d+)?/);
  if (match) {
    return { version: match[0] };
  }

  return { version: vscode.version.split('.').slice(0, 2).join('.') };
}

export async function fetchReleaseNotesMarkdown(version: string): Promise<string | undefined> {
  const [major, minor] = version.split('.');
  const candidates = [
    version,
    major && minor ? `${major}.${minor}` : version,
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.replace(/\./g, '_'));

  const branches = ['main', 'vnext'];

  for (const branch of branches) {
    for (const cleanVersion of candidates) {
      const url = `https://raw.githubusercontent.com/microsoft/vscode-docs/${branch}/release-notes/v${cleanVersion}.md`;
      const content = await new Promise<string | undefined>((resolve) => {
        https.get(url, (res) => {
          if (res.statusCode !== 200) {
            resolve(undefined);
            return;
          }

          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => { resolve(data); });
        }).on('error', () => {
          resolve(undefined);
        });
      });

      if (content) {
        const result: ReleaseNotesFetchResult = { markdown: content };
        return result.markdown;
      }
    }
  }

  return undefined;
}

export function preprocessReleaseNotesMarkdown(markdown: string, languageCode: string): string {
  let result = markdown.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/m, '');

  result = result.replace(/<!--\s*DOWNLOAD_LINKS_PLACEHOLDER\s*-->/g, '');

  const mediaPlaceholder = `\n<atm-media-placeholder data-hint="${escapeHtmlAttribute(getMediaPlaceholderHint(languageCode))}"></atm-media-placeholder>\n`;

  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, mediaPlaceholder);
  result = result.replace(/\[[^\]]+\]\(([^)]+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|ogg)(?:\?[^)]*)?)\)/gi, mediaPlaceholder);
  result = result.replace(/<img\b[^>]*>/gi, mediaPlaceholder);
  result = result.replace(/<video\b[\s\S]*?<\/video>/gi, mediaPlaceholder);
  result = result.replace(/<source\b[^>]*>/gi, '');

  return result;
}

function isReleaseNotesTab(tab: vscode.Tab | undefined): boolean {
  if (!tab) {
    return false;
  }

  return /release notes/i.test(tab.label);
}

function getMediaPlaceholderHint(languageCode: string): string {
  if (languageCode === 'es') {
    return '← Imagen oficial en el panel izquierdo';
  }

  if (/^zh\b/i.test(languageCode)) {
    return '← 官方图片请看左侧面板';
  }

  return '← Official image in the left panel';
}

function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

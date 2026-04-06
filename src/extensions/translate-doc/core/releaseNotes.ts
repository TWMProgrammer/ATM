import * as vscode from 'vscode';
import { escapeHtmlAttribute } from './utils';


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
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) { continue; }
        return await res.text();
      } catch {
        // Network error or timeout — try next candidate / branch
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
  const hints: Record<string, string> = {
    'es':    '← Imagen oficial en el panel izquierdo',
    'pt':    '← Imagem oficial no painel esquerdo',
    'fr':    '← Image officielle dans le panneau gauche',
    'de':    '← Offizielles Bild im linken Panel',
    'ru':    '← Официальное изображение в левой панели',
    'ja':    '← 公式画像は左パネルをご覧ください',
    'ko':    '← 공식 이미지는 왼쪽 패널을 확인하세요',
    'zh-CN': '← 官方图片请看左侧面板',
    'zh-TW': '← 官方圖片請看左側面板',
  };

  // Exact match first, then prefix match (e.g. 'zh' → 'zh-CN')
  if (hints[languageCode]) { return hints[languageCode]; }
  const prefix = Object.keys(hints).find((k) => languageCode.startsWith(k.split('-')[0]));
  return prefix ? hints[prefix] : '← Official image in the left panel';
}


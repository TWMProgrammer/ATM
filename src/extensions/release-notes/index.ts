import * as https from 'https';
import * as vscode from 'vscode';
import { translateText } from '../markdown-store/core/translator';
import { showLanguageQuickPick } from '../markdown-store/ui/quickPick';
import { TranslatorWebviewPanel } from '../markdown-store/ui/webview';
import type { TranslationTarget } from '../markdown-store/ui/webview';

interface ReleaseNotesFetchResult {
    markdown: string;
    baseUrl: string;
}

/**
 * 📢 RELEASE NOTES EXTENSION
 * Specifically designed to detect, fetch, and translate VS Code Release Notes.
 */

export function activateReleaseNotes(context: vscode.ExtensionContext) {
    // Keep a stable context key so menus/keybindings can reliably detect
    // when the active tab is Release Notes across VS Code versions.
    const updateReleaseNotesContext = () => {
        const isActive = isReleaseNotesTab(vscode.window.tabGroups?.activeTabGroup?.activeTab);
        void vscode.commands.executeCommand('setContext', 'atm.releaseNotes.active', isActive);
    };

    updateReleaseNotesContext();
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(updateReleaseNotesContext));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabGroups(updateReleaseNotesContext));

    const translateCmd = vscode.commands.registerCommand('atm.release-notes.translate', async () => {
        // 1. Detect version from active tab
        const versionInfo = detectVersionFromReleaseNotesTab();
        if (!versionInfo) {
            vscode.window.showInformationMessage('Please open the VS Code Release Notes tab first.');
            return;
        }

        // 2. Select language
        const lang = await showLanguageQuickPick();
        if (!lang) {
            return;
        }

        // 3. Fetch Markdown from official VS Code docs repo
        const target: TranslationTarget = {
            displayName: `VS Code ${versionInfo.version} Notes`,
            languageLabel: lang.label,
        };

        const panel = TranslatorWebviewPanel.createOrShow(context.extensionUri, target);
        panel.setSkeleton();

        try {
            const fetched = await fetchReleaseNotesMarkdown(versionInfo.version);
            if (!fetched) {
                throw new Error('Could not fetch the release notes content.');
            }

            const cleanMarkdown = preprocessReleaseNotesMarkdown(fetched.markdown, fetched.baseUrl);

            const translated = await translateText(cleanMarkdown, lang.code);
            panel.setTranslatedMarkdown(translated);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to translate Release Notes: ${error.message}`);
            panel.setError('Could not load or translate the release notes. Please check your connection.');
        }
    });

    context.subscriptions.push(translateCmd);
}

/**
 * Parses the active tab label to find the VS Code version.
 * Typical labels: "Release Notes: 1.86", "Release Notes", etc.
 */
function detectVersionFromReleaseNotesTab(): { version: string } | undefined {
    const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
    if (!activeTab || !isReleaseNotesTab(activeTab)) {
        return undefined;
    }

    const label = activeTab.label;

    // Try to extract version like 1.86 or 1.86.0
    const match = label.match(/\d+\.\d+(?:\.\d+)?/);
    if (match) {
        return { version: match[0] };
    }

    // Fallback: Use current VS Code version major.minor
    return { version: vscode.version.split('.').slice(0, 2).join('.') };
}

function isReleaseNotesTab(tab: vscode.Tab | undefined): boolean {
    if (!tab) {
        return false;
    }

    // Works for labels like "Release Notes", "Release Notes: 1.111.0", etc.
    return /release notes/i.test(tab.label);
}

/**
 * Fetches the Markdown source for a specific VS Code version using Node.js https.
 * Tries 'main' branch first, then 'vnext' as fallback.
 */
async function fetchReleaseNotesMarkdown(version: string): Promise<ReleaseNotesFetchResult | undefined> {
    // Try exact first (e.g. 1.111.0), then fallback to major.minor (1.111)
    // because docs are usually stored as v1_111.md.
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
                return {
                    markdown: content,
                    baseUrl: `https://raw.githubusercontent.com/microsoft/vscode-docs/${branch}/release-notes/`,
                };
            }
        }
    }

    return undefined;
}

function preprocessReleaseNotesMarkdown(markdown: string, baseUrl: string): string {
    // Remove YAML frontmatter block at the top (--- ... ---)
    let result = markdown.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]*/m, '');

    // Remove VS Code docs placeholders/comments that do not make sense in webview
    result = result.replace(/<!--\s*DOWNLOAD_LINKS_PLACEHOLDER\s*-->/g, '');

    // Replace media with a lightweight placeholder banner for performance.
    // This avoids broken assets from relative docs paths and heavy media rendering.
    const mediaPlaceholder = '\n<atm-media-placeholder></atm-media-placeholder>\n';

    // Markdown image syntax: ![alt](url)
    result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, mediaPlaceholder);

    // Markdown links that point directly to media files
    result = result.replace(/\[[^\]]+\]\(([^)]+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|ogg)(?:\?[^)]*)?)\)/gi, mediaPlaceholder);

    // Inline HTML media
    result = result.replace(/<img\b[^>]*>/gi, mediaPlaceholder);
    result = result.replace(/<video\b[\s\S]*?<\/video>/gi, mediaPlaceholder);
    result = result.replace(/<source\b[^>]*>/gi, '');

    // Keep parameter used until we remove the old absolute URL pathway in a later cleanup.
    void baseUrl;

    return result;
}

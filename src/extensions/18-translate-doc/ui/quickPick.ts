import * as vscode from 'vscode';

export interface LanguageItem extends vscode.QuickPickItem {
    code: string;
}

export async function showLanguageQuickPick(): Promise<LanguageItem | undefined> {
    const languages: LanguageItem[] = [
        { label: '🇪🇸 Español', description: 'Spanish', code: 'es' },
        { label: '🇨🇳 中文', description: 'Chinese (Simplified)', code: 'zh-CN' },
        { label: '🇷🇺 Русский', description: 'Russian', code: 'ru' },
        { label: '🇧🇷 Português', description: 'Portuguese', code: 'pt' },
        { label: '🇯🇵 日本語', description: 'Japanese', code: 'ja' },
        { label: '🇰🇷 한국어', description: 'Korean', code: 'ko' },
        { label: '🇫🇷 Français', description: 'French', code: 'fr' },
        { label: '🇩🇪 Deutsch', description: 'German', code: 'de' },
        { label: '🇺🇸 English', description: 'English', code: 'en' },
    ];

    const result = await vscode.window.showQuickPick(languages, {
        placeHolder: 'Select a language to translate to',
        matchOnDescription: true
    });

    return result;
}

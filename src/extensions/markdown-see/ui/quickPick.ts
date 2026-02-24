import * as vscode from 'vscode';

export interface LanguageItem extends vscode.QuickPickItem {
    code: string;
}

export async function showLanguageQuickPick(): Promise<LanguageItem | undefined> {
    const languages: LanguageItem[] = [
        { label: '🇺🇸 English', description: 'English', code: 'en' },
        { label: '🇪🇸 Español', description: 'Spanish', code: 'es' },
        { label: '🇨🇳 中文', description: 'Chinese (Simplified)', code: 'zh-CN' }
    ];

    const result = await vscode.window.showQuickPick(languages, {
        placeHolder: 'Select a language to translate to',
        matchOnDescription: true
    });

    return result;
}

import * as vscode from "vscode";

export enum Settings {
    Identifier = "tailwind-css",
    Enabled = "enabled",
    AutoFold = "autoFold",
    UnfoldIfLineSelected = "unfoldIfLineSelected",
    SupportedLanguages = "supportedLanguages",
    FoldStyle = "foldStyle",
    ShowTailwindImage = "showTailwindImage",
    FoldedText = "foldedText",
    FoldedTextColor = "foldedTextColor",
    FoldedTextBackgroundColor = "foldedTextBackgroundColor",
    UnfoldedTextOpacity = "unfoldedTextOpacity",
    FoldLengthThreshold = "foldLengthThreshold",
}

export const DEFAULT_SUPPORTED_LANGUAGES = ["html", "vue", "javascriptreact", "typescriptreact", "svelte", "astro"];

export function set(key: Settings, value: unknown): Thenable<void> {
    return vscode.workspace.getConfiguration(Settings.Identifier).update(key, value, true);
}

export function get<T>(key: Settings, defaultValue?: T): T {
    const value = vscode.workspace.getConfiguration(Settings.Identifier).get<T>(key);
    return value !== undefined ? value : (defaultValue as T);
}

import * as vscode from 'vscode';
import semver from 'semver';
import { DependencyInfo } from '../core/parser';

export async function updateVersionString(dep: DependencyInfo, newVersion: string, uriString: string) {
    if (!uriString) { return; }

    const uri = vscode.Uri.parse(uriString);
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    if (!editor) { return; }

    const finalVersionToInject = getVersionToInject(dep.currentVersion, newVersion);

    await editor.edit(editBuilder => {
        const lineText = editor.document.lineAt(dep.line).text;
        const replaceRegex = new RegExp(`"${dep.name}"\\s*:\\s*"${dep.currentVersion}"`);
        const match = replaceRegex.exec(lineText);
        
        if (match) {
            const index = match.index;
            const replacement = `"${dep.name}": "${finalVersionToInject}"`;
            editBuilder.replace(new vscode.Range(dep.line, index, dep.line, index + match[0].length), replacement);
        }
    });
}

export async function updateAllVersions(depsToUpdate: {dep: DependencyInfo, newVersion: string}[], document: vscode.TextDocument) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (!editor) { return; }

    await editor.edit(editBuilder => {
        // Reverse order so that line edits don't affect subsequent line numbers
        // Although here we are only editing within the line so it might not matter, but it's safer.
        const sortedUpdates = [...depsToUpdate].sort((a, b) => b.dep.line - a.dep.line);

        for (const {dep, newVersion} of sortedUpdates) {
            const finalVersionToInject = getVersionToInject(dep.currentVersion, newVersion);
            const lineText = editor.document.lineAt(dep.line).text;
            const replaceRegex = new RegExp(`"${dep.name}"\\s*:\\s*"${dep.currentVersion}"`);
            const match = replaceRegex.exec(lineText);
            
            if (match) {
                const index = match.index;
                const replacement = `"${dep.name}": "${finalVersionToInject}"`;
                editBuilder.replace(new vscode.Range(dep.line, index, dep.line, index + match[0].length), replacement);
            }
        }
    });
}

function getVersionToInject(currentVersion: string, newVersion: string): string {
    // Preservar el prefijo de rango: ^, ~, >=, <=, >, <, =
    const prefix = currentVersion.match(/^[~^>=<]*/)?.[0] || '';
    return `${prefix}${newVersion}`;
}

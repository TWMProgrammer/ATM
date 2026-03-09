import * as vscode from 'vscode';
import semver from 'semver';
import { parsePackageJson } from '../core/parser';
import { fetchPackageLatestVersion } from '../core/versionFetcher';
import { getDocumentCache } from '../core/state';

// Using Error-Lens style decorations passed from index.ts
export async function clearDecorations(
    editor: vscode.TextEditor,
    styles: { updateAvailable: vscode.TextEditorDecorationType; updateRecommended: vscode.TextEditorDecorationType; upToDate: vscode.TextEditorDecorationType; loading: vscode.TextEditorDecorationType; }
) {
    editor.setDecorations(styles.updateAvailable, []);
    editor.setDecorations(styles.updateRecommended, []);
    editor.setDecorations(styles.upToDate, []);
    editor.setDecorations(styles.loading, []);
    vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
}

export async function updateDecorations(
    document: vscode.TextDocument,
    styles: { updateAvailable: vscode.TextEditorDecorationType; updateRecommended: vscode.TextEditorDecorationType; upToDate: vscode.TextEditorDecorationType; loading: vscode.TextEditorDecorationType; }
) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (!editor) { return; }

    const dependencies = parsePackageJson(document);
    const documentCache = getDocumentCache(document.uri.toString());
    
    // 1. Mostrar estado de carga inicial "checking..."
    const loadingOptions: vscode.DecorationOptions[] = dependencies.map(dep => {
        return {
            range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
            renderOptions: { 
                after: { contentText: ' checking...' } 
            }
        };
    });
    
    if (dependencies.length > 0) {
        editor.setDecorations(styles.loading, loadingOptions);
    }
    
    editor.setDecorations(styles.updateAvailable, []);
    editor.setDecorations(styles.updateRecommended, []);
    editor.setDecorations(styles.upToDate, []);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Fetching latest package versions...",
    }, async () => {
        const results = await Promise.all(dependencies.map(async dep => {
            const info = await fetchPackageLatestVersion(dep.name, dep.currentVersion);
            return { dep, info };
        }));

        const updateAvailableOptions: vscode.DecorationOptions[] = [];
        const updateRecommendedOptions: vscode.DecorationOptions[] = [];
        const upToDateOptions: vscode.DecorationOptions[] = [];

        for (const { dep, info } of results) {
            if (info.error || (!info.latest && !info.satisfies)) {
                continue;
            }

            documentCache.set(dep.line, {
                name: dep.name,
                currentVersion: dep.currentVersion,
                line: dep.line,
                info: info
            });

            const currentCoerced = semver.coerce(dep.currentVersion);
            const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

            if (isUpToDateWithLatest) {
                upToDateOptions.push({
                    range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
                    renderOptions: { 
                        after: { contentText: ` ✓ latest` } 
                    }
                });
            } else {
                const isSafeRange = dep.currentVersion.startsWith('^');

                if (isSafeRange) {
                    updateRecommendedOptions.push({
                        range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
                        renderOptions: { 
                            after: { contentText: ` Recommended Version ` } 
                        }
                    });
                } else {
                    updateAvailableOptions.push({
                        range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
                        renderOptions: { 
                            after: { contentText: ` Update → ${info.latest}` } 
                        }
                    });
                }
            }
        }

        // Una vez listos, quitamos los de loading y asignamos los reales
        editor.setDecorations(styles.loading, []);
        editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
        editor.setDecorations(styles.updateRecommended, updateRecommendedOptions);
        editor.setDecorations(styles.upToDate, upToDateOptions);

        // Activamos o desactivamos el context visual superior según haya o no updates
        vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', updateAvailableOptions.length > 0 || updateRecommendedOptions.length > 0);
    });
}

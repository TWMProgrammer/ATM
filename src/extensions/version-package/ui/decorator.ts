import * as vscode from 'vscode';
import semver from 'semver';
import { parsePackageJson } from '../core/parser';
import { fetchPackageLatestVersion } from '../core/versionFetcher';
import { getDocumentCache } from '../core/state';

// Using Error-Lens style decorations passed from index.ts
export async function clearDecorations(
    editor: vscode.TextEditor,
    styles: { updateAvailable: vscode.TextEditorDecorationType; upToDate: vscode.TextEditorDecorationType; loading: vscode.TextEditorDecorationType; }
) {
    editor.setDecorations(styles.updateAvailable, []);
    editor.setDecorations(styles.upToDate, []);
    editor.setDecorations(styles.loading, []);
    vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
}

export async function updateDecorations(
    document: vscode.TextDocument,
    styles: { updateAvailable: vscode.TextEditorDecorationType; upToDate: vscode.TextEditorDecorationType; loading: vscode.TextEditorDecorationType; }
) {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (!editor) { return; }

    const dependencies = parsePackageJson(document);
    const documentCache = getDocumentCache(document.uri.toString());
    
    // 1. Mostrar estado de carga inicial "checking..." (Ghost Text Temporal)
    const loadingOptions: vscode.DecorationOptions[] = dependencies.map(dep => ({
        range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
        renderOptions: { after: { contentText: '  checking...' } }
    }));
    
    // Solo mostramos "checking" si realmente vamos a hacer fetch
    if (dependencies.length > 0) {
        editor.setDecorations(styles.loading, loadingOptions);
    }
    
    // Limpiamos los anteriores mientras cargamos por si quedaron colgados
    editor.setDecorations(styles.updateAvailable, []);
    editor.setDecorations(styles.upToDate, []);

    // Lanzar Spinner en la barra de estado
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Fetching latest package versions...",
    }, async () => {
        // Enviar API fetch en paralelo!
        const results = await Promise.all(dependencies.map(async dep => {
            const info = await fetchPackageLatestVersion(dep.name, dep.currentVersion);
            return { dep, info };
        }));

        const updateAvailableOptions: vscode.DecorationOptions[] = [];
        const upToDateOptions: vscode.DecorationOptions[] = [];

        for (const { dep, info } of results) {
            if (info.error || (!info.latest && !info.satisfies)) {
                continue; // Skip silencioso para mantener UI limpio
            }

            // Actualizar caché de memoria para el HoverProvider y UpdateAll
            documentCache.set(dep.line, {
                name: dep.name,
                currentVersion: dep.currentVersion,
                line: dep.line,
                info: info
            });

            // Mejoramos el rendimiento y robustez extrayendo la version sin regex
            const currentCoerced = semver.coerce(dep.currentVersion);
            const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

            let ghostText = '';
            
            // Si está actualizado
            if (isUpToDateWithLatest) {
                ghostText = `  ✓ Up to date`;
                upToDateOptions.push({
                    range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
                    renderOptions: { after: { contentText: ghostText } }
                });
            } else {
                // Si hay actualización
                ghostText = `  Update: ${info.latest}`;
                updateAvailableOptions.push({
                    range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
                    renderOptions: { after: { contentText: ghostText } }
                });
            }
        }

        // Una vez listos, quitamos los de loading y asignamos los reales
        editor.setDecorations(styles.loading, []);
        editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
        editor.setDecorations(styles.upToDate, upToDateOptions);

        // Activamos o desactivamos el context visual superior según haya o no updates
        vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', updateAvailableOptions.length > 0);
    });
}

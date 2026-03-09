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
    
    // Filtramos qué dependencias realmente necesitan "checking..."
    // Si ya tenemos info en cache y la versión en el archivo es la misma, no parpadeamos el loading.
    const dependenciesToFetch = dependencies.filter(dep => {
        const cached = documentCache.get(dep.line);
        // Si no está en cache, O la versión en el archivo cambió, necesitamos pedir de nuevo.
        return !cached || cached.currentVersion !== dep.currentVersion || cached.name !== dep.name;
    });

    // 1. Mostrar estado de carga SOLO para lo que cambió o es nuevo
    const loadingOptions: vscode.DecorationOptions[] = dependenciesToFetch.map(dep => ({
        range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
        renderOptions: { after: { contentText: ' checking...' } }
    }));

    // Mantener las decoraciones actuales para lo que NO se va a refrescar
    const updateAvailableOptions: vscode.DecorationOptions[] = [];
    const updateRecommendedOptions: vscode.DecorationOptions[] = [];
    const upToDateOptions: vscode.DecorationOptions[] = [];

    // Función auxiliar para clasificar y agregar a las listas de opciones
    const classifyDecoration = (dep: { line: number, currentVersion: string }, info: any) => {
        const currentCoerced = semver.coerce(dep.currentVersion);
        const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

        const decoration = {
            range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
            renderOptions: { after: { contentText: '' } }
        };

        if (isUpToDateWithLatest) {
            decoration.renderOptions.after!.contentText = ` ✓ latest`;
            upToDateOptions.push(decoration);
        } else {
            const isSafeRange = dep.currentVersion.startsWith('^');
            if (isSafeRange) {
                decoration.renderOptions.after!.contentText = ` Recommended Version `;
                updateRecommendedOptions.push(decoration);
            } else {
                decoration.renderOptions.after!.contentText = ` Update → ${info.latest}`;
                updateAvailableOptions.push(decoration);
            }
        }
    };

    // Poblar con lo que ya tenemos en cache (lo que no vamos a re-descargar)
    dependencies.forEach(dep => {
        const cached = documentCache.get(dep.line);
        if (cached && cached.currentVersion === dep.currentVersion && cached.name === dep.name) {
            classifyDecoration(dep, cached.info);
        }
    });

    // Pintar estado inicial (cache + los nuevos en loading)
    editor.setDecorations(styles.loading, loadingOptions);
    editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
    editor.setDecorations(styles.updateRecommended, updateRecommendedOptions);
    editor.setDecorations(styles.upToDate, upToDateOptions);

    if (dependenciesToFetch.length === 0) {
        return; // Nada nuevo que buscar
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Fetching latest package versions...",
    }, async () => {
        await Promise.all(dependenciesToFetch.map(async (dep) => {
            const info = await fetchPackageLatestVersion(dep.name, dep.currentVersion);
            
            // Quitar el checking de ese item
            const loadingIdx = loadingOptions.findIndex(o => o.range.start.line === dep.line);
            if (loadingIdx !== -1) {
                loadingOptions.splice(loadingIdx, 1);
            }

            if (!info.error && (info.latest || info.satisfies)) {
                documentCache.set(dep.line, {
                    name: dep.name,
                    currentVersion: dep.currentVersion,
                    line: dep.line,
                    info: info
                });
                classifyDecoration(dep, info);
            }

            // Actualización progresiva sin parpadeo global
            editor.setDecorations(styles.loading, loadingOptions);
            editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
            editor.setDecorations(styles.updateRecommended, updateRecommendedOptions);
            editor.setDecorations(styles.upToDate, upToDateOptions);
        }));

        vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', updateAvailableOptions.length > 0 || updateRecommendedOptions.length > 0);
    });
}

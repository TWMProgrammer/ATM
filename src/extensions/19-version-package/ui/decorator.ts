import * as vscode from 'vscode';
import semver from 'semver';
import { parsePackageJson } from '../core/parser';
import { fetchPackageLatestVersion } from '../core/versionFetcher';
import { getDocumentCache } from '../core/state';

/* =========================================================
 * 🎨 CLEAR DECORATIONS
 * Using Error-Lens style decorations passed from index.ts
 * ========================================================= */
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
    
    /* =========================================================
     * 🔍 FILTER DEPENDENCIES
     * Filter which dependencies actually need "checking..."
     * If we already have info in cache and the version in the file is the same, do not blink the loading state.
     * ========================================================= */
    const dependenciesToFetch = dependencies.filter(dep => {
        const cached = documentCache.get(dep.line);
        // If it's not in cache, OR the version in the file changed, we need to request again
        return !cached || cached.currentVersion !== dep.currentVersion || cached.name !== dep.name;
    });

    // 1. Show loading state ONLY for what changed or is new
    const loadingOptions: vscode.DecorationOptions[] = dependenciesToFetch.map(dep => ({
        range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
        renderOptions: { after: { contentText: 'checking...' } }
    }));

    // Keep current decorations for what will NOT be refreshed
    const updateAvailableOptions: vscode.DecorationOptions[] = [];
    const updateRecommendedOptions: vscode.DecorationOptions[] = [];
    const upToDateOptions: vscode.DecorationOptions[] = [];

    /* =========================================================
     * 🏷️ CLASSIFY DECORATION HELPER
     * Helper function to classify and add to option lists
     * ========================================================= */
    const classifyDecoration = (dep: { line: number, currentVersion: string }, info: any) => {
        const currentCoerced = semver.coerce(dep.currentVersion);
        const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

        const decoration = {
            range: new vscode.Range(dep.line, Number.MAX_VALUE, dep.line, Number.MAX_VALUE),
            renderOptions: { after: { contentText: '' } }
        };

        if (isUpToDateWithLatest) {
            decoration.renderOptions.after!.contentText = `✓ latest`;
            upToDateOptions.push(decoration);
        } else {
            const isSafeRange = dep.currentVersion.startsWith('^');
            if (isSafeRange) {
                decoration.renderOptions.after!.contentText = `Recommended Version`;
                updateRecommendedOptions.push(decoration);
            } else {
                decoration.renderOptions.after!.contentText = `Update → ${info.latest}`;
                updateAvailableOptions.push(decoration);
            }
        }
    };

    /* =========================================================
     * ⚡ POPULATE FROM CACHE
     * Populate with what we already have in cache (what we won't re-download)
     * ========================================================= */
    dependencies.forEach(dep => {
        const cached = documentCache.get(dep.line);
        if (cached && cached.currentVersion === dep.currentVersion && cached.name === dep.name) {
            classifyDecoration(dep, cached.info);
        }
    });

    /* =========================================================
     * 🖌️ PAINT INITIAL STATE
     * Paint initial state (cache + new ones loading)
     * ========================================================= */
    editor.setDecorations(styles.loading, loadingOptions);
    editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
    editor.setDecorations(styles.updateRecommended, updateRecommendedOptions);
    editor.setDecorations(styles.upToDate, upToDateOptions);

    if (dependenciesToFetch.length === 0) {
        return; // Nothing new to fetch
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Fetching latest package versions...",
    }, async () => {
        await Promise.all(dependenciesToFetch.map(async (dep) => {
            const info = await fetchPackageLatestVersion(dep.name, dep.currentVersion);
            
            // Remove checking state for this item
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

            // Progressive update without global blinking
            editor.setDecorations(styles.loading, loadingOptions);
            editor.setDecorations(styles.updateAvailable, updateAvailableOptions);
            editor.setDecorations(styles.updateRecommended, updateRecommendedOptions);
            editor.setDecorations(styles.upToDate, upToDateOptions);
        }));

        vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', updateAvailableOptions.length > 0 || updateRecommendedOptions.length > 0);
    });
}

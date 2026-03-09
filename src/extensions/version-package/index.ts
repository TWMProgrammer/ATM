import * as vscode from 'vscode';
import semver from 'semver';
import { clearVersionCache } from './core/versionFetcher';
import { updateVersionString, updateAllVersions } from './commands/updateCommand';
import { updateDecorations, clearDecorations } from './ui/decorator';
import { createDecorationStyles } from './ui/styles';
import { VersionHoverProvider } from './ui/hoverProvider';
import { clearPackageState, getDocumentCache } from './core/state';

const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 600;

// Set para controlar qué archivos se comprobarán explícitamente al pulsar el botón
const activeChecks = new Set<string>();

export function activateVersionPackage(context: vscode.ExtensionContext) {
    const styles = createDecorationStyles();

    // 1. Comando: Actualización individual desde el Hover
    context.subscriptions.push(
        vscode.commands.registerCommand('atm.versionPackage.updateVersionString', updateVersionString)
    );

    // 2. Comando: Actualizar TODO (botoncito magico $(wand))
    context.subscriptions.push(vscode.commands.registerCommand('atm.versionPackage.updateAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('package.json')) {
            return;
        }

        const cache = getDocumentCache(editor.document.uri.toString());
        const toUpdate: any[] = [];

        cache.forEach((state) => {
            const currentCoerced = semver.coerce(state.currentVersion);
            if (state.info.latest && !(currentCoerced && semver.eq(currentCoerced, state.info.latest))) {
                toUpdate.push({
                    dep: {
                        name: state.name,
                        currentVersion: state.currentVersion,
                        line: state.line,
                        range: new vscode.Range(state.line, 0, state.line, 0)
                    },
                    newVersion: state.info.latest
                });
            }
        });

        if (toUpdate.length > 0) {
            updateAllVersions(toUpdate, editor.document);
        } else {
            vscode.window.showInformationMessage("All packages are already up-to-date! ✅");
        }
    }));

    // 3. Comando: Forzar chequeo manual explícito
    context.subscriptions.push(vscode.commands.registerCommand('atm.versionPackage.check', () => {
        clearVersionCache();
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.endsWith('package.json')) {
            const uriStr = editor.document.uri.toString();
            activeChecks.add(uriStr);
            clearPackageState(uriStr);
            triggerUpdateDecorations(editor.document, styles);
        }
    }));
    
    // 4. Hover Provider Native para un rendimiento estelar (0 lag)
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: 'json', pattern: '**/package.json' }, new VersionHoverProvider())
    );

    // Evento: Al editar el archivo (debounce)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'json' && e.document.fileName.endsWith('package.json')) {
            if (activeChecks.has(e.document.uri.toString())) {
                triggerUpdateDecorations(e.document, styles);
            }
        }
    }));
    
    // Evento: Cambio de ventana activa
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'json' && editor.document.fileName.endsWith('package.json')) {
            if (activeChecks.has(editor.document.uri.toString())) {
                triggerUpdateDecorations(editor.document, styles);
            }
        } else {
            vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
        }
    }));

    // Cleanup de memoria pura al cerrar
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        if (doc.fileName.endsWith('package.json')) {
            const uriStr = doc.uri.toString();
            activeChecks.delete(uriStr);
            debounceTimers.delete(uriStr);
            clearPackageState(uriStr);
            vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
        }
    }));
    
    context.subscriptions.push(styles);
}

function triggerUpdateDecorations(document: vscode.TextDocument, styles: any) {
    const key = document.uri.toString();
    const existing = debounceTimers.get(key);
    if (existing) {
        clearTimeout(existing);
    }
    
    debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        updateDecorations(document, styles).catch(console.error);
    }, DEBOUNCE_MS));
}

export function deactivate() {
    clearVersionCache();
    clearPackageState();
}


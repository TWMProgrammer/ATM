import * as vscode from 'vscode';
import semver from 'semver';
import { clearVersionCache } from './core/versionFetcher';
import { updateVersionString, updateAllVersions } from './commands/updateCommand';
import { DependencyInfo } from './core/parser';
import { updateDecorations } from './ui/decorator';
import { createDecorationStyles } from './ui/styles';
import { VersionHoverProvider } from './ui/hoverProvider';
import { clearPackageState, getDocumentCache } from './core/state';

const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 600;

// =========================================================
// 🎯 ACTIVE CHECKS SET
// Set to control which files will be explicitly checked when clicking the button
// =========================================================
const activeChecks = new Set<string>();

export function activateVersionPackage(context: vscode.ExtensionContext) {
    const styles = createDecorationStyles();

    // =========================================================
    // 1️⃣ INDIVIDUAL UPDATE COMMAND (FROM HOVER)
    // =========================================================
    context.subscriptions.push(
        vscode.commands.registerCommand('atm.versionPackage.updateVersionString', updateVersionString)
    );

    // =========================================================
    // 2️⃣ UPDATE ALL COMMAND (MAGIC WAND)
    // =========================================================
    context.subscriptions.push(vscode.commands.registerCommand('atm.versionPackage.updateAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('package.json')) {
            return;
        }

        const cache = getDocumentCache(editor.document.uri.toString());
        const toUpdate: { dep: DependencyInfo; newVersion: string }[] = [];

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
            vscode.window.showInformationMessage(vscode.l10n.t("All packages are already up-to-date! ✅"));
        }
    }));

    // =========================================================
    // 3️⃣ FORCE EXPLICIT MANUAL CHECK COMMAND
    // =========================================================
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
    
    // =========================================================
    // 4️⃣ NATIVE HOVER PROVIDER (0 LAG PERFORMANCE)
    // =========================================================
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: 'json', pattern: '**/package.json' }, new VersionHoverProvider())
    );

    // =========================================================
    // ⚡ ON FILE EDIT EVENT (DEBOUNCED)
    // =========================================================
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'json' && e.document.fileName.endsWith('package.json')) {
            if (activeChecks.has(e.document.uri.toString())) {
                triggerUpdateDecorations(e.document, styles);
            }
        }
    }));
    
    // =========================================================
    // 🪟 ACTIVE WINDOW CHANGE EVENT
    // =========================================================
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'json' && editor.document.fileName.endsWith('package.json')) {
            if (activeChecks.has(editor.document.uri.toString())) {
                triggerUpdateDecorations(editor.document, styles);
            }
        } else {
            vscode.commands.executeCommand('setContext', 'atm.versionPackage.hasUpdates', false);
        }
    }));

    // =========================================================
    // 🧹 PURE MEMORY CLEANUP ON CLOSE
    // =========================================================
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
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
    activeChecks.clear();
    clearVersionCache();
    clearPackageState();
}


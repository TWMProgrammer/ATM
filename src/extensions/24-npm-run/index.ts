import * as vscode from 'vscode';
import { PackageState, analyzePackageState, findPublishablePackage } from './core/detector';
import { ReleaseKind, isReleaseBranch, runRelease } from './core/release';
import { createStatusBar, hideStatusBar, issueSummary, showBusy, showState } from './ui/status-bar';

let currentState: PackageState | undefined;
let releasing = false;
let refreshTimer: NodeJS.Timeout | undefined;

export function activateNpmRun(context: vscode.ExtensionContext): void {
    createStatusBar(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('atm.npmRun.release', () => {
            void release('patch');
        }),
        vscode.commands.registerCommand('atm.npmRun.releaseMajor', () => {
            void release('major');
        }),
        vscode.commands.registerCommand('atm.npmRun.releaseMinor', () => {
            void release('minor');
        }),
        vscode.commands.registerCommand('atm.npmRun.releaseBeta', () => {
            void release('beta');
        }),
        vscode.commands.registerCommand('atm.npmRun.refresh', () => {
            void refresh();
        }),
        vscode.commands.registerCommand('atm.npmRun.showStatus', () => {
            void showStatus();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            void refresh();
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.fileName.endsWith('package.json') && !document.fileName.includes('node_modules')) {
                scheduleRefresh();
            }
        })
    );

    void refresh();
}

function scheduleRefresh(): void {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
        void refresh();
    }, 1000);
}

async function refresh(): Promise<void> {
    if (releasing) {
        return;
    }
    const pkg = findPublishablePackage();
    if (!pkg) {
        currentState = undefined;
        hideStatusBar();
        return;
    }
    currentState = await analyzePackageState(pkg);
    if (!releasing) {
        showState(currentState);
    }
}

/** Re-checks the package state and only returns it when a release can start. */
async function ensureReadyState(): Promise<PackageState | undefined> {
    await refresh();
    if (!currentState) {
        void vscode.window.showInformationMessage(vscode.l10n.t('No publishable npm package found in this workspace.'));
        return undefined;
    }
    if (currentState.issues.length > 0 || !isReleaseBranch(currentState.currentBranch)) {
        void showStatus();
        return undefined;
    }
    return currentState;
}

async function release(kind: ReleaseKind): Promise<void> {
    if (releasing) {
        return;
    }
    const state = await ensureReadyState();
    if (!state) {
        return;
    }
    releasing = true;
    showBusy(state.pkg.name);
    try {
        await runRelease(state, kind);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(vscode.l10n.t('Release failed: {0}', message));
    } finally {
        releasing = false;
        void refresh();
    }
}

/** Explains why the button is blocked (readiness issue or wrong branch). */
async function showStatus(): Promise<void> {
    const state = currentState;
    if (!state) {
        return;
    }
    const issue = state.issues[0];
    if (issue) {
        const recheck = vscode.l10n.t('Re-check');
        const choice = await vscode.window.showWarningMessage(`${state.pkg.name}: ${issueSummary(issue)}`, recheck);
        if (choice === recheck) {
            void refresh();
        }
        return;
    }
    if (!isReleaseBranch(state.currentBranch)) {
        void vscode.window.showInformationMessage(
            vscode.l10n.t(
                'Releases run from "dev" or "main". You are on "{0}" — switch branch, then release.',
                state.currentBranch ?? '?'
            )
        );
        return;
    }
    void vscode.window.showInformationMessage(vscode.l10n.t('{0} is ready to release.', state.pkg.name));
}

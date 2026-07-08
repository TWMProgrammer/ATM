import * as vscode from 'vscode';
import { PackageState, analyzePackageState, findPublishablePackage } from './core/detector';
import { getCommitSubjectsSince, getLastTag } from './core/git';
import { ReleaseType, computeNextVersions, runRelease, suggestReleaseType } from './core/release';
import { createPublishWorkflow, openFirstPublishTerminal, showTokenChecklist } from './core/setup';
import { createStatusBar, hideStatusBar, issueSummary, showBusy, showState } from './ui/status-bar';
import { pickReleaseType } from './ui/version-picker';

let currentState: PackageState | undefined;
let releasing = false;
let refreshTimer: NodeJS.Timeout | undefined;

export function activateNpmRun(context: vscode.ExtensionContext): void {
    createStatusBar(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('atm.npmRun.release', () => {
            void releaseWithPicker();
        }),
        vscode.commands.registerCommand('atm.npmRun.releaseMajor', () => {
            void release('major');
        }),
        vscode.commands.registerCommand('atm.npmRun.releaseMinor', () => {
            void release('minor');
        }),
        vscode.commands.registerCommand('atm.npmRun.releasePatch', () => {
            void release('patch');
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
    if (currentState.issues.length > 0) {
        void showStatus();
        return undefined;
    }
    return currentState;
}

async function release(type: ReleaseType): Promise<void> {
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
        await runRelease(state, type);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(vscode.l10n.t('Release failed: {0}', message));
    } finally {
        releasing = false;
        void refresh();
    }
}

async function releaseWithPicker(): Promise<void> {
    if (releasing) {
        return;
    }
    const state = await ensureReadyState();
    if (!state) {
        return;
    }

    const next = computeNextVersions(state.pkg.version);
    if (!next) {
        void vscode.window.showErrorMessage(
            vscode.l10n.t('Cannot compute the next version from "{0}".', state.pkg.version)
        );
        return;
    }

    let suggested: ReleaseType = 'patch';
    if (state.repoRoot) {
        try {
            const lastTag = await getLastTag(state.repoRoot);
            suggested = suggestReleaseType(await getCommitSubjectsSince(state.repoRoot, lastTag));
        } catch {
            // the suggestion is optional
        }
    }

    const type = await pickReleaseType(state.pkg.name, state.pkg.version, next, suggested);
    if (type) {
        await release(type);
    }
}

/** Explains the first blocking issue and offers its next step. */
async function showStatus(): Promise<void> {
    const state = currentState;
    if (!state) {
        return;
    }
    const issue = state.issues[0];
    if (!issue) {
        void vscode.window.showInformationMessage(vscode.l10n.t('{0} is ready to release.', state.pkg.name));
        return;
    }

    const summary = issueSummary(issue);

    if (issue === 'not-on-npm') {
        const openTerminal = vscode.l10n.t('Open Terminal');
        const recheck = vscode.l10n.t('Re-check');
        const choice = await vscode.window.showWarningMessage(
            vscode.l10n.t(
                '{0}: {1} Steps: 1) npm login --auth-type=web  2) bun pm pack --dry-run  3) bun publish. Once it is on npm, the release button activates by itself.',
                state.pkg.name,
                summary
            ),
            openTerminal,
            recheck
        );
        if (choice === openTerminal) {
            openFirstPublishTerminal(state.pkg.dir);
        } else if (choice === recheck) {
            void refresh();
        }
        return;
    }

    if (issue === 'no-workflow' && state.repoRoot) {
        const create = vscode.l10n.t('Create publish.yml');
        const choice = await vscode.window.showWarningMessage(`${state.pkg.name}: ${summary}`, create);
        if (choice === create) {
            try {
                createPublishWorkflow(state.repoRoot);
                await showTokenChecklist(state.github);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(message);
            }
            void refresh();
        }
        return;
    }

    const recheck = vscode.l10n.t('Re-check');
    const choice = await vscode.window.showWarningMessage(`${state.pkg.name}: ${summary}`, recheck);
    if (choice === recheck) {
        void refresh();
    }
}

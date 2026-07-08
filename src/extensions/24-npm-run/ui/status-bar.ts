import * as vscode from 'vscode';
import { PackageState, ReadinessIssue } from '../core/detector';
import { computeNextVersions } from '../core/release';

let item: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): void {
    item = vscode.window.createStatusBarItem('atm.npmRun.status', vscode.StatusBarAlignment.Right, 90);
    item.name = 'ATM NPM Release';
    context.subscriptions.push(item);
}

export function hideStatusBar(): void {
    item?.hide();
}

export function showBusy(name: string): void {
    if (!item) {
        return;
    }
    item.text = `$(sync~spin) ${name}`;
    item.tooltip = vscode.l10n.t('Release in progress…');
    item.command = undefined;
    item.backgroundColor = undefined;
    item.show();
}

export function issueSummary(issue: ReadinessIssue): string {
    switch (issue) {
        case 'not-on-npm':
            return vscode.l10n.t('This package is not published on npm yet — the first publish is done manually.');
        case 'no-git-repo':
            return vscode.l10n.t('This package folder is not inside a git repository.');
        case 'no-github-remote':
            return vscode.l10n.t(
                'No GitHub remote found — releases are published by GitHub Actions, so the repository must live on GitHub.'
            );
        case 'repo-mismatch':
            return vscode.l10n.t(
                'package.json points to a different GitHub repository than this folder — move the package to its own repository before releasing.'
            );
        case 'no-workflow':
            return vscode.l10n.t(
                'No publish workflow found — GitHub Actions needs .github/workflows/publish.yml to publish on each version tag.'
            );
    }
}

export function showState(state: PackageState): void {
    if (!item) {
        return;
    }
    const { pkg, issues } = state;

    if (issues.length > 0) {
        item.text = `$(warning) ${pkg.name}`;
        item.tooltip = issueSummary(issues[0]);
        item.command = 'atm.npmRun.showStatus';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        item.show();
        return;
    }

    item.text = `$(rocket) ${pkg.name} v${pkg.version}`;
    item.command = 'atm.npmRun.release';
    item.backgroundColor = undefined;

    const next = computeNextVersions(pkg.version);
    if (next) {
        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.isTrusted = true;
        tooltip.appendMarkdown(vscode.l10n.t('**Release {0}** — current v{1}', pkg.name, pkg.version));
        tooltip.appendMarkdown('\n\n');
        tooltip.appendMarkdown(
            `[v${next.major}](command:atm.npmRun.releaseMajor "major — breaking changes") | ` +
                `[v${next.minor}](command:atm.npmRun.releaseMinor "minor — new features") | ` +
                `[v${next.patch}](command:atm.npmRun.releasePatch "patch — fixes") | ` +
                `[beta](command:atm.npmRun.releaseBeta "v${next.beta} — test release under the beta tag")`
        );
        item.tooltip = tooltip;
    } else {
        item.tooltip = vscode.l10n.t('Release {0}', pkg.name);
    }
    item.show();
}

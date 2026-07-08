import * as vscode from 'vscode';
import { PackageState, ReadinessIssue } from '../core/detector';
import { computeBetaTarget, computeTarget } from '../core/release';

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
        case 'no-git-repo':
            return vscode.l10n.t('This package folder is not inside a git repository.');
        case 'no-github-remote':
            return vscode.l10n.t(
                'No GitHub remote found — releases are published by GitHub Actions, so the repository must live on GitHub.'
            );
    }
}

export function showState(state: PackageState): void {
    if (!item) {
        return;
    }
    const { pkg, issues, publishedVersion } = state;

    if (issues.length > 0) {
        item.text = `$(warning) ${pkg.name}`;
        item.tooltip = issueSummary(issues[0]);
        item.command = 'atm.npmRun.showStatus';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        item.show();
        return;
    }

    // The button always shows the version a click would release.
    const target = computeTarget(pkg.version, publishedVersion);
    if (!target) {
        item.text = `$(warning) ${pkg.name}`;
        item.tooltip = vscode.l10n.t('Cannot compute the next version from "{0}".', pkg.version);
        item.command = 'atm.npmRun.showStatus';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        item.show();
        return;
    }

    item.text = `$(rocket) ${pkg.name} v${target.version}`;
    item.command = 'atm.npmRun.release';
    item.backgroundColor = undefined;

    const tooltip = new vscode.MarkdownString(undefined, true);
    tooltip.isTrusted = true;
    tooltip.appendMarkdown(
        vscode.l10n.t('**Release {0}** — npm has v{1}', pkg.name, publishedVersion ?? pkg.version)
    );
    if (!target.needsBump) {
        tooltip.appendMarkdown('\n\n');
        tooltip.appendMarkdown(vscode.l10n.t('Version taken from package.json (you bumped it manually).'));
    }
    const beta = computeBetaTarget(pkg.version);
    tooltip.appendMarkdown('\n\n');
    tooltip.appendMarkdown(
        `[$(rocket) v${target.version}](command:atm.npmRun.release "${vscode.l10n.t('release — merge, tag and publish')}")` +
            (beta
                ? ` | [$(beaker) v${beta}](command:atm.npmRun.releaseBeta "${vscode.l10n.t('beta — test release under the beta tag')}")`
                : '')
    );
    item.tooltip = tooltip;
    item.show();
}

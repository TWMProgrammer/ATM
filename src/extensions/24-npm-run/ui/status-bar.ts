import * as vscode from 'vscode';
import { PackageState, ReadinessIssue } from '../core/detector';
import { bumpVersion, computeBetaTarget, computeTarget, isReleaseBranch } from '../core/release';

let item: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): void {
    item = vscode.window.createStatusBarItem('atm.npmRun.status', vscode.StatusBarAlignment.Right, 999);
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
    item.color = undefined;
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
    item.color = undefined;
    const { pkg, issues, publishedVersion, lastTagVersion, currentBranch } = state;

    if (issues.length > 0) {
        item.text = `$(warning) ${pkg.name}`;
        item.tooltip = issueSummary(issues[0]);
        item.command = 'atm.npmRun.showStatus';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        item.show();
        return;
    }

    // Locked (gray) unless on a release branch — releases only from dev/main.
    if (!isReleaseBranch(currentBranch)) {
        item.text = `$(lock) ${pkg.name}`;
        item.tooltip = vscode.l10n.t(
            'Releases run from "dev" or "main". You are on "{0}" — switch branch to release.',
            currentBranch ?? '?'
        );
        item.command = 'atm.npmRun.showStatus';
        item.color = new vscode.ThemeColor('disabledForeground');
        item.backgroundColor = undefined;
        item.show();
        return;
    }

    // The button shows/releases the next patch (or your manual bump); the
    // tooltip carries major, minor and beta.
    const baseline = publishedVersion ?? lastTagVersion;
    const target = computeTarget(pkg.version, baseline);
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

    const major = bumpVersion(pkg.version, 'major');
    const minor = bumpVersion(pkg.version, 'minor');
    const beta = computeBetaTarget(pkg.version);

    const tooltip = new vscode.MarkdownString(undefined, true);
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    if (publishedVersion) {
        tooltip.appendMarkdown(vscode.l10n.t('**Release {0}** — npm has v{1}', pkg.name, publishedVersion));
    } else {
        tooltip.appendMarkdown(vscode.l10n.t('**Release {0}**', pkg.name));
    }
    if (!target.needsBump) {
        tooltip.appendMarkdown('\n');
        tooltip.appendMarkdown(vscode.l10n.t('Releasing v{0} from package.json (you set it manually).', target.version));
    }
    tooltip.appendMarkdown('\n');
    const links: string[] = [];
    if (major) {
        links.push(
            `[$(arrow-up) v${major}](command:atm.npmRun.releaseMajor "${vscode.l10n.t('major — breaking changes')}")`
        );
    }
    if (minor) {
        links.push(
            `[$(arrow-small-up) v${minor}](command:atm.npmRun.releaseMinor "${vscode.l10n.t('minor — new features')}")`
        );
    }
    if (beta) {
        links.push(
            `[$(beaker) Beta](command:atm.npmRun.releaseBeta "v${beta} — ${vscode.l10n.t('test release under the beta tag')}")`
        );
    }
    tooltip.appendMarkdown(links.join(' | '));
    item.tooltip = tooltip;
    item.show();
}

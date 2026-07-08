import * as vscode from 'vscode';
import { NextVersions, ReleaseType } from '../core/release';

interface ReleaseQuickPickItem extends vscode.QuickPickItem {
    type: ReleaseType;
}

export async function pickReleaseType(
    name: string,
    current: string,
    next: NextVersions,
    suggested: ReleaseType
): Promise<ReleaseType | undefined> {
    const suggestedSuffix = (type: ReleaseType): string =>
        type === suggested ? ` · ${vscode.l10n.t('suggested by recent commits')}` : '';

    const items: ReleaseQuickPickItem[] = [
        {
            type: 'major',
            label: `$(rocket) v${next.major}`,
            description: vscode.l10n.t('major — breaking changes') + suggestedSuffix('major'),
        },
        {
            type: 'minor',
            label: `$(rocket) v${next.minor}`,
            description: vscode.l10n.t('minor — new features') + suggestedSuffix('minor'),
        },
        {
            type: 'patch',
            label: `$(rocket) v${next.patch}`,
            description: vscode.l10n.t('patch — fixes and small changes') + suggestedSuffix('patch'),
        },
        {
            type: 'beta',
            label: `$(beaker) v${next.beta}`,
            description: vscode.l10n.t('beta — test release, normal users keep getting v{0}', current),
        },
    ];

    const picked = await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t('Release {0}', name),
        placeHolder: vscode.l10n.t('Current version: v{0} — choose the new version', current),
    });
    return picked?.type;
}

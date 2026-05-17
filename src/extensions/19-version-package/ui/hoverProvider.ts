import * as vscode from 'vscode';
import semver from 'semver';
import { getDocumentCache } from '../core/state';

export class VersionHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        /* =========================================================
         * ⚡ EXTRACT CACHE
         * Extract saved cache extremely fast without processing anything extra
         * ========================================================= */
        const cache = getDocumentCache(document.uri.toString());
        const state = cache.get(position.line);

        if (!state) {
            return null; // Nothing to show, mouse is not hovering a dependency
        }

        const { name, currentVersion, info } = state;
        const currentCoerced = semver.coerce(currentVersion);
        const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

        if (isUpToDateWithLatest) {
            return null; // Extreme performance saving: do not paint hover if already updated
        }

        const hoverMd = new vscode.MarkdownString('', true);
        hoverMd.isTrusted = true;

        hoverMd.appendMarkdown(`### 📦 **${name}**\n\n`);
        
        const currentTag = `<span style="color:#888888;">Current: ${currentVersion}</span>`;
        const latestTag = `**Latest: \`${info.latest}\`**`;
        
        hoverMd.appendMarkdown(`${currentTag} &nbsp;&nbsp; → &nbsp;&nbsp; ${latestTag}\n\n---\n\n`);

        const depInfoObj = {
            name,
            currentVersion,
            line: position.line,
            range: new vscode.Range(position.line, 0, position.line, 0)
        };

        const latestArgs = encodeURIComponent(JSON.stringify([depInfoObj, info.latest, document.uri.toString()]));
        
        const isSafeRange = currentVersion.startsWith('^');
        let updateLink = isSafeRange 
            ? `<span style="color:#888888;">Update</span>` 
            : `[Update $(arrow-up)](command:atm.versionPackage.updateVersionString?${latestArgs} "Upgrade to ${info.latest}")`;

        let bottomLine = `[NPM](https://www.npmjs.com/package/${name})&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;[BundlePhobia](https://bundlephobia.com/package/${name})&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;${updateLink}`;
        
        if (info.satisfies && info.satisfies !== info.latest && !(currentCoerced && semver.eq(currentCoerced, info.satisfies))) {
            const satisfiesArgs = encodeURIComponent(JSON.stringify([depInfoObj, info.satisfies, document.uri.toString()]));
            bottomLine += `&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;[Safe Patch (\`${info.satisfies}\`)](command:atm.versionPackage.updateVersionString?${satisfiesArgs} "Install safe patch ${info.satisfies}")`;
        }

        hoverMd.appendMarkdown(bottomLine + `\n\n`);

        return new vscode.Hover(hoverMd);
    }
}

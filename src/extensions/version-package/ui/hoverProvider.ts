import * as vscode from 'vscode';
import semver from 'semver';
import { getDocumentCache } from '../core/state';

export class VersionHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        // Extraemos el caché guardado velozmente sin procesar nada extra
        const cache = getDocumentCache(document.uri.toString());
        const state = cache.get(position.line);

        if (!state) {
            return null; // Nada que mostrar, el mouse no está sobre una dependencia
        }

        const { name, currentVersion, info } = state;
        const currentCoerced = semver.coerce(currentVersion);
        const isUpToDateWithLatest = currentCoerced && info.latest && semver.eq(currentCoerced, info.latest);

        // Ahorro extremo de rendimiento: Si está actulizado, no pintar Hover
        if (isUpToDateWithLatest) {
            return null;
        }

        const hoverMd = new vscode.MarkdownString('', true);
        hoverMd.isTrusted = true;

        hoverMd.appendMarkdown(`### 📦 ${name}\n\n`);
        
        const currentTag = `<span style="color:#888888;">current: ${currentVersion}</span>`;
        const latestTag = `**latest: \`${info.latest}\`**`;
        
        hoverMd.appendMarkdown(`${currentTag} &nbsp;&nbsp; → &nbsp;&nbsp; ${latestTag}\n\n---\n\n`);
            
        const depInfoObj = {
            name,
            currentVersion,
            line: position.line,
            range: new vscode.Range(position.line, 0, position.line, 0)
        };

        const latestArgs = encodeURIComponent(JSON.stringify([depInfoObj, info.latest, document.uri.toString()]));
        hoverMd.appendMarkdown(`[🚀 Upgrade to Latest](command:atm.versionPackage.updateVersionString?${latestArgs})`);
        
        if (info.satisfies && info.satisfies !== info.latest && !(currentCoerced && semver.eq(currentCoerced, info.satisfies))) {
            const satisfiesArgs = encodeURIComponent(JSON.stringify([depInfoObj, info.satisfies, document.uri.toString()]));
            hoverMd.appendMarkdown(`&nbsp;&nbsp;|&nbsp;&nbsp;[✨ Safe patch (\`${info.satisfies}\`)](command:atm.versionPackage.updateVersionString?${satisfiesArgs})`);
        }
        
        hoverMd.appendMarkdown(`\n\n[NPM](https://www.npmjs.com/package/${name})&nbsp;&nbsp;•&nbsp;&nbsp;[BundlePhobia](https://bundlephobia.com/package/${name})`);

        return new vscode.Hover(hoverMd);
    }
}

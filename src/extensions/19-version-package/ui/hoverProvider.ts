import * as vscode from 'vscode';
import { DependencyInfo } from '../core/parser';
import { getDocumentCache } from '../core/state';
import { canUpdateVersionString, getVersionStatus } from '../core/versionStatus';

export class VersionHoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const state = getDocumentCache(document.uri.toString()).get(position.line);
		if (!state) {
			return null;
		}

		const { name, currentVersion, info } = state;
		const status = getVersionStatus(currentVersion, info);
		if (status.kind === 'latest' || status.kind === 'newer' || status.kind === 'unknown') {
			return null;
		}

		const hover = new vscode.MarkdownString('', true);
		hover.isTrusted = { enabledCommands: ['atm.versionPackage.updateVersionString'] };
		hover.appendMarkdown(`### 📦 **${name}**\n\n`);
		hover.appendMarkdown(`Current: \`${currentVersion}\` &nbsp;&nbsp; → &nbsp;&nbsp; **Latest: \`${status.latest}\`**\n\n---\n\n`);

		const dependency: DependencyInfo = {
			name,
			currentVersion,
			line: position.line,
			range: new vscode.Range(position.line, 0, position.line, 0)
		};
		const links = [
			`[NPM](https://www.npmjs.com/package/${encodeURIComponent(name)})`,
			`[BundlePhobia](https://bundlephobia.com/package/${encodeURIComponent(name)})`
		];

		if (canUpdateVersionString(currentVersion) && status.target) {
			const label = status.kind === 'major' ? 'Major upgrade' : status.kind === 'breaking' ? 'Breaking upgrade' : 'Update';
			links.push(createUpdateLink(label, dependency, status.target, document.uri.toString()));
		}

		if (canUpdateVersionString(currentVersion) && status.safeTarget && status.safeTarget !== status.target) {
			links.push(createUpdateLink(`Safe update (\`${status.safeTarget}\`)`, dependency, status.safeTarget, document.uri.toString()));
		}

		hover.appendMarkdown(`${links.join('&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;')}\n\n`);
		return new vscode.Hover(hover);
	}
}

function createUpdateLink(label: string, dependency: DependencyInfo, target: string, uri: string): string {
	const args = encodeURIComponent(JSON.stringify([dependency, target, uri]));
	return `[${label}](command:atm.versionPackage.updateVersionString?${args} "Update to ${target}")`;
}

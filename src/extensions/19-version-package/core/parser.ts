import semver from 'semver';
import * as vscode from 'vscode';

export interface DependencyInfo {
	name: string;
	currentVersion: string;
	line: number;
	range: vscode.Range;
}

export function parsePackageJson(document: vscode.TextDocument): DependencyInfo[] {
	const dependencies: DependencyInfo[] = [];
	const lines = document.getText().split(/\r?\n/);
	let inDependencyBlock = false;

	for (let line = 0; line < lines.length; line++) {
		const lineText = lines[line];
		if (/"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:/.test(lineText)) {
			inDependencyBlock = true;
			continue;
		}

		if (inDependencyBlock && /^\s*}/.test(lineText)) {
			inDependencyBlock = false;
			continue;
		}

		if (!inDependencyBlock) {
			continue;
		}

		const match = lineText.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
		if (!match || !match[2].trim() || !semver.validRange(match[2])) {
			continue;
		}

		const start = lineText.indexOf(match[0]);
		dependencies.push({
			name: match[1],
			currentVersion: match[2],
			line,
			range: new vscode.Range(line, start, line, start + match[0].length)
		});
	}

	return dependencies;
}

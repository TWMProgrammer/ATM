import semver from 'semver';
import * as vscode from 'vscode';
import { DependencyInfo } from '../core/parser';
import { canUpdateVersionString } from '../core/versionStatus';

export async function updateVersionString(dep: DependencyInfo, newVersion: string, uriString: string): Promise<void> {
	if (!uriString || !canUpdateVersionString(dep.currentVersion) || !semver.valid(newVersion)) {
		return;
	}

	const uri = vscode.Uri.parse(uriString);
	const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document.uri.toString() === uri.toString());
	if (!editor) {
		return;
	}

	const document = editor.document;
	const replaceRegex = createDependencyRegex(dep);
	let targetLine = dep.line;
	let lineText = targetLine >= 0 && targetLine < document.lineCount ? document.lineAt(targetLine).text : '';

	if (!replaceRegex.test(lineText)) {
		for (let line = 0; line < document.lineCount; line++) {
			if (replaceRegex.test(document.lineAt(line).text)) {
				targetLine = line;
				lineText = document.lineAt(line).text;
				break;
			}
		}
	}

	const match = replaceRegex.exec(lineText);
	if (!match) {
		return;
	}

	await editor.edit(editBuilder => {
		const replacement = `"${dep.name}": "${getVersionToInject(dep.currentVersion, newVersion)}"`;
		editBuilder.replace(
			new vscode.Range(targetLine, match.index, targetLine, match.index + match[0].length),
			replacement
		);
	});
}

export async function updateAllVersions(
	depsToUpdate: { dep: DependencyInfo; newVersion: string }[],
	document: vscode.TextDocument
): Promise<void> {
	const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document === document);
	if (!editor) {
		return;
	}

	await editor.edit(editBuilder => {
		const sortedUpdates = [...depsToUpdate].sort((left, right) => right.dep.line - left.dep.line);

		for (const { dep, newVersion } of sortedUpdates) {
			if (
				!canUpdateVersionString(dep.currentVersion)
				|| !semver.valid(newVersion)
				|| dep.line < 0
				|| dep.line >= editor.document.lineCount
			) {
				continue;
			}

			const lineText = editor.document.lineAt(dep.line).text;
			const match = createDependencyRegex(dep).exec(lineText);
			if (match) {
				const replacement = `"${dep.name}": "${getVersionToInject(dep.currentVersion, newVersion)}"`;
				editBuilder.replace(
					new vscode.Range(dep.line, match.index, dep.line, match.index + match[0].length),
					replacement
				);
			}
		}
	});
}

function getVersionToInject(currentVersion: string, newVersion: string): string {
	const prefix = currentVersion.match(/^(?:(?:\^|~|>=|<=|>|<|=)?v?)/)?.[0] ?? '';
	return `${prefix}${newVersion}`;
}

function createDependencyRegex(dep: DependencyInfo): RegExp {
	return new RegExp(`"${escapeRegExp(dep.name)}"\\s*:\\s*"${escapeRegExp(dep.currentVersion)}"`);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

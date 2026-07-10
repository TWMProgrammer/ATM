/* Git Commands — host entry point.
 *
 * Thin orchestrator: imports data from core/categories, rendering from
 * core/builder, and wires the VS Code webview panel lifecycle.
 * Add new commands in core/categories.ts, new SVGs/HTML in core/builder.ts. */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';

import { GIT_CATEGORIES } from './core/categories';
import {
	buildCommandsHtml,
	buildNoResultsHtml,
	buildToastHtml,
	gitBrandSvg,
} from './core/builder';

export { GIT_CATEGORIES } from './core/categories';
export type { GitCategory, GitCommand } from './core/types';

/* ------------------------------------------------------------------ */
/* Panel singleton                                                     */
/* ------------------------------------------------------------------ */

let panel: vscode.WebviewPanel | undefined;

export function activateGitCommands(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('atm.gitCommands.open', () => {
		if (panel) {
			panel.reveal(vscode.ViewColumn.One);
			return;
		}

		panel = vscode.window.createWebviewPanel(
			'atmGitCommands',
			'Git Commands',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'src', 'extensions', '21-23-25', 'pages', 'git-commands', 'ui'),
					vscode.Uri.joinPath(context.extensionUri, 'dist'),
				],
			},
		);

		panel.iconPath = vscode.Uri.file(context.asAbsolutePath('src/assets/atm-logo.png'));
		panel.onDidDispose(() => { panel = undefined; });
		panel.webview.html = buildWebviewContent(context, panel.webview);

		panel.webview.onDidReceiveMessage((msg: unknown) => {
			if (!msg || typeof msg !== 'object') { return; }
			const m = msg as { type?: string; command?: string };
			if (m.type === 'copy' && m.command) {
				vscode.env.clipboard.writeText(m.command);
			}
		});
	});

	context.subscriptions.push(disposable);
}

/* ------------------------------------------------------------------ */
/* Webview HTML assembly                                               */
/* ------------------------------------------------------------------ */

function buildWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
	const uiRoot = vscode.Uri.joinPath(
		context.extensionUri,
		'src', 'extensions', '21-23-25', 'pages', 'git-commands', 'ui',
	);

	const html = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'git-commands.html').fsPath, 'utf8');
	const css  = fs.readFileSync(vscode.Uri.joinPath(uiRoot, 'git-commands.css').fsPath,  'utf8');

	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'dist', 'git-commands.js'),
	);

	const nonce = crypto.randomUUID().replace(/-/g, '');
	const csp = [
		`default-src 'none'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`font-src https://fonts.gstatic.com`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	return html
		.replace('<!-- ATM_GIT_STYLES -->',
			`<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>\n${css}\n\t</style>`)
		.replace('<!-- ATM_GIT_SCRIPT -->',
			`<script src="${scriptUri}" nonce="${nonce}"></script>`)
		.replace('<!-- ATM_GIT_ICON -->',    gitBrandSvg())
		.replace('<!-- ATM_GIT_COMMANDS -->', buildCommandsHtml(GIT_CATEGORIES) + '\n' + buildNoResultsHtml())
		.replace('<!-- ATM_GIT_TOAST -->',   buildToastHtml());
}

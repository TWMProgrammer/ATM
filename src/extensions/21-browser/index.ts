import * as vscode from 'vscode';

const browserPanelViewType = 'atm.browser';

export function activateBrowser(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('atm.browser.open', () => {
			const panel = vscode.window.createWebviewPanel(
				browserPanelViewType,
				'ATM Browser',
				vscode.ViewColumn.Active,
				{
					enableScripts: false,
					retainContextWhenHidden: true,
				}
			);

			panel.webview.html = getBrowserHtml();
		})
	);
}

function getBrowserHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ATM Browser</title>
	<style>
		body {
			align-items: center;
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			display: flex;
			font-family: var(--vscode-font-family);
			height: 100vh;
			justify-content: center;
			margin: 0;
		}

		main {
			font-size: 18px;
			font-weight: 600;
		}
	</style>
</head>
<body>
	<main>Hello World</main>
</body>
</html>`;
}

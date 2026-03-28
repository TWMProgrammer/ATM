import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function openScreenshotPanel(extensionUri: vscode.Uri, payload?: { image: string, nickname: string }) {
  if (currentPanel) {
    // If it already exists, just reveal it
    currentPanel.reveal(vscode.ViewColumn.One);
    // currentPanel.webview.postMessage({ command: 'updateImage', payload }); // Uncomment to support live updating the screenshot
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'atomScreenshot',
    'Atom Screenshot',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    }
  );


  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined; // Free the reference when the tab is closed
    },
    null,
  );

  const nicknameDisplay = payload?.nickname ? `@${payload.nickname}` : 'Atom';

  currentPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atom Screenshot</title>
    <style>
        body { 
            background: #0a0a0a; 
            color: #e0e0e0; 
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            font-family: Consolas, 'Courier New', monospace;
            font-size: 2rem;
        }
        img {
            max-width: 80%;
            max-height: 80%;
            border: 2px solid #555;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h1>Hello ${nicknameDisplay} <span style="font-size: 1.5rem;">🎮</span></h1>
    ${payload?.image ? `<img src="${payload.image}" alt="Atom Screenshot" />` : ''}
</body>
</html>`;
}

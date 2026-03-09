import * as vscode from 'vscode';

let isProcessingSvg = false;

export function activateSvgBetter(context: vscode.ExtensionContext) {
  // Listen for new tabs being opened
  const disposable = vscode.window.tabGroups.onDidChangeTabs(async (e) => {
    // If we're already handling a split, or no tabs were opened, we ignore
    if (isProcessingSvg || e.opened.length === 0) {
      return;
    }

    for (const tab of e.opened) {
      let uri: vscode.Uri | undefined;
      let isTextEditor = false;

      // Check if it's a text editor (code) or custom editor (image preview)
      if (tab.input instanceof vscode.TabInputText) {
        uri = tab.input.uri;
        isTextEditor = true;
      } else if (tab.input instanceof vscode.TabInputCustom) {
        uri = tab.input.uri;
      }

      // Only proceed if it's an SVG file
      if (uri && uri.path.toLowerCase().endsWith('.svg')) {
        isProcessingSvg = true;

        try {
          // Find all current tabs to avoid duplicates
          const allTabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
          
          const hasTextTab = allTabs.some(t => 
            t.input instanceof vscode.TabInputText && 
            t.input.uri.toString() === uri!.toString()
          );
          
          const hasCustomTab = allTabs.some(t => 
            t.input instanceof vscode.TabInputCustom && 
            t.input.uri.toString() === uri!.toString()
          );

          // If both text and image are already open for this SVG, do nothing
          if (hasTextTab && hasCustomTab) {
            continue;
          }

          if (isTextEditor) {
            // Code is already active (usually left). Open image to the right.
            await vscode.commands.executeCommand(
              'vscode.openWith',
              uri,
              'imagePreview.previewEditor',
              { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }
            );
          } else {
            // Image is active (usually left). We want Code on left, Image on right.
            
            // 1. Open the Code in the current active panel (left)
            await vscode.window.showTextDocument(uri, {
              viewColumn: vscode.ViewColumn.Active,
              preserveFocus: false // Focus the code so the next open targets beside it
            });

            // 2. Open the Image preview beside the code (right)
            await vscode.commands.executeCommand(
              'vscode.openWith',
              uri,
              'imagePreview.previewEditor',
              { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }
            );

            // 3. Close the original image tab that was on the left to avoid duplicates
            await vscode.window.tabGroups.close(tab);
          }
        } catch (error) {
          console.error('[SVG Better] Failed to auto-split view:', error);
        } finally {
          // Release the lock after a short delay
          setTimeout(() => {
            isProcessingSvg = false;
          }, 300);
        }
      }
    }
  });

  const optimizeCmd = vscode.commands.registerCommand('atm.svgBetter.optimize', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.toLowerCase().endsWith('.svg')) {
      vscode.window.showErrorMessage('No SVG file is currently active.');
      return;
    }

    const document = editor.document;
    const svgContent = document.getText();

    try {
      const { optimize } = await import('svgo/browser');
      const result = optimize(svgContent, {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                cleanupIds: false,
                removeUnknownsAndDefaults: false
              }
            }
          },
          'removeDoctype',
          'removeComments',
          {
            name: 'removeAttrs',
            params: {
              attrs: ['xmlns:xlink', 'xml:space']
            }
          }
        ]
      });

      if (result !== null && 'data' in result) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(svgContent.length)
        );
        edit.replace(document.uri, fullRange, result.data);

        await vscode.workspace.applyEdit(edit);

        const originalSize = Buffer.byteLength(svgContent, 'utf8');
        const optimizedSize = Buffer.byteLength(result.data, 'utf8');
        const savingPercent = (((originalSize - optimizedSize) / originalSize) * 100).toFixed(2);
        const originalSizeKB = (originalSize / 1024).toFixed(2);
        const optimizedSizeKB = (optimizedSize / 1024).toFixed(2);

        vscode.window.showInformationMessage(
          `SVG optimized. Reduced from ${originalSizeKB} KB to ${optimizedSizeKB} KB (${savingPercent}% saved)`
        );
      } else {
        vscode.window.showErrorMessage('Failed to optimize SVG: Unknown error.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to optimize SVG: ${error}`);
    }
  });

  context.subscriptions.push(disposable, optimizeCmd);
}

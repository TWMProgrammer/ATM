import * as vscode from 'vscode';

let isProcessingSvg = false;

/**
 * Activates the SVG Better extension features.
 * Provides auto-split view for SVGs and an SVGO optimization command.
 */
export function activateSvgBetter(context: vscode.ExtensionContext) {
  const splitViewDisposable = setupSplitView();
  const optimizeDisposable = setupOptimizeCommand();

  context.subscriptions.push(splitViewDisposable, optimizeDisposable);
}

/* =========================================================
 * ✂️ SPLIT VIEW FEATURE
 * ========================================================= */

/**
 * Registers the tab open event and triggers auto-split view for SVG files.
 */
function setupSplitView(): vscode.Disposable {
  return vscode.window.tabGroups.onDidChangeTabs(async (e) => {
    // If we're already handling a split, or no tabs were opened, we ignore
    if (isProcessingSvg || e.opened.length === 0) {
      return;
    }

    for (const tab of e.opened) {
      let uri: vscode.Uri | undefined;
      let isTextEditor = false;

      if (tab.input instanceof vscode.TabInputText) {
        uri = tab.input.uri;
        isTextEditor = true;
      } else if (tab.input instanceof vscode.TabInputCustom) {
        uri = tab.input.uri;
      }

      if (uri && isSvgFile(uri)) {
        isProcessingSvg = true;

        try {
          await handleSvgSplitView(tab, uri, isTextEditor);
        } catch (error) {
          console.error('[SVG Better] Failed to auto-split view:', error);
        } finally {
          setTimeout(() => {
            isProcessingSvg = false;
          }, 300);
        }
        
        break; // Only process one SVG at a time to prevent concurrency issues
      }
    }
  });
}

/**
 * Internal handler to split the view into text document & side-by-side image preview.
 */
async function handleSvgSplitView(
  tab: vscode.Tab,
  uri: vscode.Uri,
  isTextEditor: boolean
): Promise<void> {
  const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);

  const hasTextTab = allTabs.some(
    (t) => t.input instanceof vscode.TabInputText && t.input.uri.toString() === uri.toString()
  );

  const hasCustomTab = allTabs.some(
    (t) => t.input instanceof vscode.TabInputCustom && t.input.uri.toString() === uri.toString()
  );

  // If both text and image are already open for this SVG, do nothing
  if (hasTextTab && hasCustomTab) {
    return;
  }

  if (isTextEditor) {
    // Code is active (left). Open image to the right.
    await vscode.commands.executeCommand('vscode.openWith', uri, 'imagePreview.previewEditor', {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    });
  } else {
    // Image is active. We want Code on left, Image on right.
    await vscode.window.showTextDocument(uri, {
      viewColumn: vscode.ViewColumn.Active,
      preserveFocus: false, // Focus the code so the next open targets beside it
    });

    await vscode.commands.executeCommand('vscode.openWith', uri, 'imagePreview.previewEditor', {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    });

    // Close the original image tab that was on the left
    await vscode.window.tabGroups.close(tab);
  }
}

/* =========================================================
 * ⚡ OPTIMIZATION FEATURE
 * ========================================================= */

/**
 * Registers the SVGO optimization command 'atm.svgBetter.optimize'.
 */
function setupOptimizeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('atm.svgBetter.optimize', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSvgFile(editor.document.uri)) {
      vscode.window.showErrorMessage('No SVG file is currently active.');
      return;
    }

    const document = editor.document;
    const svgContent = document.getText();

    try {
      const resultData = await optimizeSvg(svgContent);

      if (resultData) {
        await applyOptimization(document, resultData);
        showOptimizationResult(svgContent, resultData);
      } else {
        vscode.window.showErrorMessage('Failed to optimize SVG: Unknown error.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to optimize SVG: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Invokes SVGO to optimize the raw SVG content.
 */
async function optimizeSvg(content: string): Promise<string | null> {
  const { optimize } = await import('svgo/browser');
  const result = optimize(content, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
            removeUnknownsAndDefaults: false,
          },
        },
      },
      'removeDoctype',
      'removeComments',
      {
        name: 'removeAttrs',
        params: {
          attrs: ['xmlns:xlink', 'xml:space'],
        },
      },
    ],
  });

  return (result !== null && 'data' in result) ? result.data : null;
}

/**
 * Applies the optimized SVG content efficiently as a full range workspace edit.
 */
async function applyOptimization(document: vscode.TextDocument, optimizedContent: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  edit.replace(document.uri, fullRange, optimizedContent);
  await vscode.workspace.applyEdit(edit);
}

/**
 * Compares the original and optimized strings and notifies user about saved space.
 */
function showOptimizationResult(originalContent: string, optimizedContent: string): void {
  const originalSize = getByteSize(originalContent);
  const optimizedSize = getByteSize(optimizedContent);

  const savingPercent = calculateSavingPercent(originalSize, optimizedSize);
  const originalSizeKB = formatSizeKB(originalSize);
  const optimizedSizeKB = formatSizeKB(optimizedSize);

  vscode.window.showInformationMessage(
    `SVG optimized. Reduced from ${originalSizeKB} KB to ${optimizedSizeKB} KB (${savingPercent}% saved)`
  );
}

/* =========================================================
 * 🛠️ UTILITIES
 * ========================================================= */

function getByteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}

function formatSizeKB(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

function calculateSavingPercent(originalSize: number, optimizedSize: number): string {
  if (originalSize === 0) {return '0.00';}
  return (((originalSize - optimizedSize) / originalSize) * 100).toFixed(2);
}

function isSvgFile(uri: vscode.Uri): boolean {
  return uri.path.toLowerCase().endsWith('.svg');
}

import * as vscode from 'vscode';

/**
 * State machine to prevent concurrent split-view handling and
 * to suppress split-view during file operations (rename, move, delete).
 */
const state = {
  processing: false,
  suppressed: false,
  suppressTimer: undefined as ReturnType<typeof setTimeout> | undefined,
};

/**
 * Activates the SVG Better extension features.
 * Provides auto-split view for SVGs and an SVGO optimization command.
 */
export function activateSvgBetter(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    ...setupFileOperationGuards(),
    setupSplitView(),
    setupOptimizeCommand()
  );
}

/* =========================================================
 * 🛡️ FILE OPERATION GUARDS
 * ========================================================= */

/**
 * Suppresses the split-view logic during file rename/move/delete/create.
 *
 * Why: When the user presses F2 (rename) in the explorer, VS Code re-opens
 * the renamed file which fires `onDidChangeTabs`. Without this guard the
 * split-view handler steals focus from the explorer inline-rename input.
 *
 * `onWillRenameFiles` fires **before** the rename starts (covers the
 * period while the user is typing the new name).
 * `onDidRenameFiles` fires **after** the rename completes (covers the
 * re-opening of the file under its new URI).
 */
function setupFileOperationGuards(): vscode.Disposable[] {
  const suppress = () => {
    state.suppressed = true;
    clearTimeout(state.suppressTimer);
    state.suppressTimer = setTimeout(() => {
      state.suppressed = false;
    }, 800);
  };

  return [
    vscode.workspace.onWillRenameFiles(suppress),
    vscode.workspace.onDidRenameFiles(suppress),
    vscode.workspace.onDidCreateFiles(suppress),
    vscode.workspace.onDidDeleteFiles(suppress),
  ];
}

/* =========================================================
 * ✂️ SPLIT VIEW FEATURE
 * ========================================================= */

/**
 * Registers the tab-open event and triggers auto-split view for SVG files.
 *
 * Rules:
 *  1. Skip if already processing, suppressed by a file-op guard, or no tabs opened.
 *  2. All editor opens use preserveFocus: true so the explorer keeps focus (F2 rename works).
 *  3. Only process one SVG per event batch (break after first match).
 */
function setupSplitView(): vscode.Disposable {
  return vscode.window.tabGroups.onDidChangeTabs(async (e) => {
    if (state.processing || state.suppressed || e.opened.length === 0) {
      return;
    }

    for (const tab of e.opened) {

      const { uri, isText } = extractTabUri(tab);

      if (uri && isSvgFile(uri)) {
        state.processing = true;

        try {
          await handleSvgSplitView(tab, uri, isText);
        } catch (error) {
          console.error('[SVG Better] Failed to auto-split view:', error);
        } finally {
          setTimeout(() => {
            state.processing = false;
          }, 300);
        }

        break;
      }
    }
  });
}

/**
 * Extracts the URI and editor-type from a tab input.
 */
function extractTabUri(tab: vscode.Tab): { uri: vscode.Uri | undefined; isText: boolean } {
  if (tab.input instanceof vscode.TabInputText) {
    return { uri: tab.input.uri, isText: true };
  }
  if (tab.input instanceof vscode.TabInputCustom) {
    return { uri: tab.input.uri, isText: false };
  }
  return { uri: undefined, isText: false };
}

/**
 * Opens a side-by-side view: text editor on the left, image preview on the right.
 *
 * Skips if both the text tab and the custom (image) tab already exist for this URI.
 */
async function handleSvgSplitView(
  tab: vscode.Tab,
  uri: vscode.Uri,
  isTextEditor: boolean
): Promise<void> {
  const uriStr = uri.toString();
  const allTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);

  const hasTextTab = allTabs.some(
    (t) => t.input instanceof vscode.TabInputText && t.input.uri.toString() === uriStr
  );

  const hasCustomTab = allTabs.some(
    (t) => t.input instanceof vscode.TabInputCustom && t.input.uri.toString() === uriStr
  );

  // Both sides of the split are already present — nothing to do.
  if (hasTextTab && hasCustomTab) {
    return;
  }

  if (isTextEditor) {
    // Text editor is active (left). Open image preview beside it.
    await vscode.commands.executeCommand('vscode.openWith', uri, 'imagePreview.previewEditor', {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    });
  } else {
    // Image preview is active. Rearrange: Code on left, Image on right.
    // preserveFocus: true — never steal focus from explorer (allows F2 rename).
    await vscode.window.showTextDocument(uri, {
      viewColumn: vscode.ViewColumn.Active,
      preserveFocus: true,
    });

    await vscode.commands.executeCommand('vscode.openWith', uri, 'imagePreview.previewEditor', {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    });

    // Remove the original image tab that was on the left.
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
 * Applies the optimized SVG content as a full-document workspace edit.
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
 * Compares original vs. optimized size and notifies the user.
 */
function showOptimizationResult(originalContent: string, optimizedContent: string): void {
  const originalSize = Buffer.byteLength(originalContent, 'utf8');
  const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');

  const savingPercent = originalSize === 0
    ? '0.00'
    : (((originalSize - optimizedSize) / originalSize) * 100).toFixed(2);

  const originalKB = (originalSize / 1024).toFixed(2);
  const optimizedKB = (optimizedSize / 1024).toFixed(2);

  vscode.window.showInformationMessage(
    `SVG optimized. Reduced from ${originalKB} KB to ${optimizedKB} KB (${savingPercent}% saved)`
  );
}

/* =========================================================
 * 🛠️ UTILITIES
 * ========================================================= */

function isSvgFile(uri: vscode.Uri): boolean {
  return uri.path.toLowerCase().endsWith('.svg');
}

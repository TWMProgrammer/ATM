import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

// ======================================
// WEBVIEW MESSAGE HANDLING | MARK: MESSAGES
// ======================================

interface WebviewMessage {
  command?: string;
  content?: string;
  panel?: string;
  language?: string;
}

/**
 * Handle a message posted from the compare-code webview.
 */
export async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
  switch (message.command) {
    case 'toggleLeftPanel':
      await togglePanel('left');
      break;
    case 'toggleRightPanel':
      await togglePanel('right');
      break;
    case 'downloadCode':
      await handleCodeDownload(message.content ?? '', message.panel ?? '');
      break;
    case 'changeLanguage':
      // Language preference lives in the webview; nothing to persist host-side.
      break;
  }
}

/**
 * The user's sidebar can be docked on either side, so "left"/"right" from the
 * webview map to whichever bar is currently on that side.
 */
async function togglePanel(side: 'left' | 'right'): Promise<void> {
  const location = vscode.workspace.getConfiguration('workbench').get('sideBar.location');
  const sidebarIsOnSide = (location === 'left') === (side === 'left');
  await vscode.commands.executeCommand(
    sidebarIsOnSide
      ? 'workbench.action.toggleSidebarVisibility'
      : 'workbench.action.toggleAuxiliaryBar'
  );
}

/**
 * Save a panel's code to a user-chosen file via the native save dialog.
 */
async function handleCodeDownload(content: string, panel: string): Promise<void> {
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const safePanel = panel === 'left' || panel === 'right' ? panel : 'code';
    const filename = `code-${safePanel}-${dateStr}.txt`;
    const defaultUri = vscode.Uri.file(path.join(os.homedir(), 'Downloads', filename));

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Text Files': ['txt'], 'All Files': ['*'] },
    });

    if (!saveUri) {
      return;
    }

    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(content, 'utf8'));
    void vscode.window.showInformationMessage(
      vscode.l10n.t('Saved {0} panel code to {1}', safePanel, path.basename(saveUri.fsPath))
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(vscode.l10n.t('Failed to save code: {0}', detail));
  }
}

/* =========================================================
 * 📜 MDX SUPPORT
 * MDX support is provided purely through TextMate grammars 
 * and language config down within package.json.
 * 
 * This extends functionality by adding live MDX preview
 * leveraging esbuild and a lightweight React Webview.
 * ========================================================= */
import * as vscode from 'vscode';
import { MdxPreviewManager } from './ui/MdxPreviewManager';

export function activateMdxPreview(context: vscode.ExtensionContext) {
  const manager = new MdxPreviewManager(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('atm.mdx.preview', () => {
      manager.showPreview();
    })
  );
}

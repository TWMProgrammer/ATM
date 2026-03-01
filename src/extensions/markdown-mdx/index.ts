/**
 * MDX Support
 * 
 * MDX support is provided purely through TextMate grammars and language configuration 
 * declared in package.json (`contributes.languages` and `contributes.grammars`).
 * 
 * This extends the functionality by adding live MDX preview leveraging esbuild
 * and a lightweight React Webview, preserving high performance.
 */
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

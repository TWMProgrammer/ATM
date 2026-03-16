import * as vscode from 'vscode';
import { getExplorerFileMeta } from '../core/utils';
import { EXPLORER_ALL_EXTENSIONS } from '../core/types';

export class ImageExplorerHoverProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  public async provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file') {
      return undefined;
    }

    const ext = uri.path.substring(uri.path.lastIndexOf('.')).toLowerCase();
    if (!EXPLORER_ALL_EXTENSIONS.includes(ext)) {
      return undefined;
    }

    try {
      const meta = await getExplorerFileMeta(uri.fsPath, ext);
      if (token.isCancellationRequested) {
        return undefined;
      }

      if (!meta.dimensions && !meta.fileSize) {
        return undefined;
      }

      const infoTokens: string[] = [];
      if (meta.fileSize) {
        infoTokens.push(meta.fileSize);
      }
      
      if (meta.dimensions) {
        // If it's a video and has the 16:9 ar info
        if (meta.additionalInfo) {
          infoTokens.push(`${meta.additionalInfo} (${meta.dimensions}px)`);
        } else {
          infoTokens.push(`${meta.dimensions}px`);
        }
      }
      
      if (meta.format) {
        infoTokens.push(meta.format);
      }

      const tooltip = infoTokens.join(' | ');

      return new vscode.FileDecoration(
        undefined, // no badge text
        tooltip,   // custom tooltip text, will be shown in explorer
        undefined  // no custom color
      );
    } catch {
      return undefined;
    }
  }

  public refresh(uri: vscode.Uri): void {
    this._onDidChangeFileDecorations.fire(uri);
  }
}

export function activateImageExplorerHover(context: vscode.ExtensionContext): void {
  const provider = new ImageExplorerHoverProvider();
  
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(provider)
  );

  // Refresh decoration when the image file gets saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.scheme === 'file') {
        const ext = doc.fileName.substring(doc.fileName.lastIndexOf('.')).toLowerCase();
        if (EXPLORER_ALL_EXTENSIONS.includes(ext)) {
          provider.refresh(doc.uri);
        }
      }
    })
  );
}

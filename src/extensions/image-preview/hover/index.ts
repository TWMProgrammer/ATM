import * as vscode from 'vscode';
import { getExplorerFileMeta } from '../core/utils';
import { EXPLORER_ALL_EXTENSIONS } from '../core/types';

// =========================================================
// 🚦 CONCURRENCY LIMITER
// Prevents disk saturation when VS Code requests decorations
// for hundreds of files simultaneously (e.g. expanding a large folder)
// =========================================================

const MAX_CONCURRENT = 8;
let activeSlots = 0;
const pendingQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeSlots < MAX_CONCURRENT) {
    activeSlots++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    pendingQueue.push(() => {
      activeSlots++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeSlots--;
  const next = pendingQueue.shift();
  if (next) { next(); }
}

// =========================================================
// 🖼️ FILE DECORATION PROVIDER
// =========================================================

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

    // Throttle: wait for an available slot before hitting the FS
    await acquireSlot();
    try {
      if (token.isCancellationRequested) {
        return undefined;
      }

      const meta = await getExplorerFileMeta(uri.fsPath, ext, token);
      if (token.isCancellationRequested) {
        return undefined;
      }

      if (!meta.dimensions && !meta.fileSize) {
        return undefined;
      }

      // Build structured tooltip with clean plain-text formatting
      const lines: string[] = [];

      if (meta.format) {
        lines.push(`⬡ ${meta.format}`);
      }

      if (meta.dimensions) {
        if (meta.additionalInfo) {
          lines.push(`⊞ ${meta.additionalInfo} — ${meta.dimensions}px`);
        } else {
          lines.push(`⊞ ${meta.dimensions}px`);
        }
      }

      if (meta.fileSize) {
        lines.push(`◉ ${meta.fileSize}`);
      }

      const tooltip = lines.join('  ·  ');

      return new vscode.FileDecoration(
        undefined, // no badge text
        tooltip,   // structured tooltip with metadata
        undefined  // no custom color
      );
    } catch {
      return undefined;
    } finally {
      releaseSlot();
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

import * as vscode from 'vscode';
import { recognizers } from '../core/recognizers';
import { mappers } from '../core/mappers';
import { getConfig } from '../core/config';
import {
  getImageMeta, isLocalFile, isDataUri,
  getCachedResolution, setCachedResolution,
  pruneMetaCache, pruneResolveCache,
  invalidateMetaCache, invalidateResolveCacheFor,
} from '../core/utils';
import { ACCEPTED_EXTENSIONS } from '../core/types';
import type { DecorationEntry, ImageInfo } from '../core/types';

/** Scan results per document URI */
const scanResults = new Map<string, {
  decorations: DecorationEntry[];
  token: vscode.CancellationTokenSource;
}>();

/** Throttle timers per document URI */
const throttleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Quick-reject heuristic: skip lines that can't possibly contain an image reference.
// This avoids running all recognizer regexes on every line.
const IMAGE_SIGNAL_PATTERN = /\.(svg|png|jpe?g|bmp|gif|ico|webp|avif|jfif)\b|data:image|https?:\/\/|!\[/i;

// ─── Core scanning logic ────────────────────────────────────────────

function scanDocument(document: vscode.TextDocument): void {
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === document.uri.toString()
  );
  if (editors.length === 0) { return; }

  const showGutter = getConfig(document, 'showImagePreviewOnGutter', true);
  const underline = getConfig(document, 'showUnderline', true);

  // Collect visible line indices
  const visibleLines = new Set<number>();
  for (const editor of editors) {
    for (const range of editor.visibleRanges) {
      for (let i = range.start.line; i <= range.end.line; i++) {
        visibleLines.add(i);
      }
    }
  }

  // Cancel previous scan
  const key = document.uri.toString();
  const prev = scanResults.get(key);
  if (prev) {
    prev.token.cancel();
    clearDecorations(document, prev.decorations);
  }

  const tokenSource = new vscode.CancellationTokenSource();
  const entry = { decorations: [] as DecorationEntry[], token: tokenSource };
  scanResults.set(key, entry);

  // Resolve workspace folder
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const workspaceFolder = folder?.uri.fsPath;

  // Detect images
  const images: ImageInfo[] = [];

  for (const lineIndex of visibleLines) {
    if (tokenSource.token.isCancellationRequested) { return; }

    const lineText = document.lineAt(lineIndex).text;
    if (!lineText || lineText.length > 20_000) { continue; }

    // Quick reject: skip lines without any image-like signal
    if (!IMAGE_SIGNAL_PATTERN.test(lineText)) { continue; }

    for (const recognizer of recognizers) {
      const matches = recognizer.recognize(lineIndex, lineText);
      for (const match of matches) {
        // Try resolution cache first
        const cacheKey = `${document.fileName}|${match.url}|${workspaceFolder ?? ''}`;
        let resolved = getCachedResolution(cacheKey);
        if (resolved === null) {
          // Not cached – resolve through mappers
          resolved = undefined;
          for (const mapper of mappers) {
            resolved = mapper.map(document.fileName, match.url, workspaceFolder);
            if (resolved) { break; }
          }
          setCachedResolution(cacheKey, resolved);
        }

        if (!resolved) { continue; }

        // Validate extension for non-data/non-http images
        if (!isDataUri(resolved) && isLocalFile(resolved)) {
          const ext = resolved.substring(resolved.lastIndexOf('.')).toLowerCase();
          if (!ACCEPTED_EXTENSIONS.includes(ext)) { continue; }
        }

        const range = new vscode.Range(lineIndex, match.start, lineIndex, match.end);
        images.push({ originalImagePath: resolved, imagePath: resolved, range });
      }
    }
  }

  // Deduplicate by range
  const seen = new Set<string>();
  const unique = images.filter((img) => {
    const k = `${img.range.start.line}:${img.range.start.character}-${img.range.end.character}:${img.imagePath}`;
    if (seen.has(k)) { return false; }
    seen.add(k);
    return true;
  });

  // Apply decorations
  for (const img of unique) {
    const uri = img.imagePath.startsWith('data:')
      ? vscode.Uri.parse(img.imagePath)
      : img.imagePath.startsWith('http')
        ? vscode.Uri.parse(img.imagePath)
        : vscode.Uri.file(img.imagePath.replace(/\\/g, '/'));

    const decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: uri,
      gutterIconSize: 'contain',
      textDecoration: underline ? 'underline' : 'none',
    });

    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(img.range.start, img.range.start),
      hoverMessage: '',
    };

    entry.decorations.push({
      type: decorationType,
      decorations: [decoration],
      originalImagePath: img.originalImagePath,
      imagePath: img.imagePath,
    });

    if (showGutter) {
      for (const editor of editors) {
        editor.setDecorations(decorationType, [decoration]);
      }
    }
  }
}

function clearDecorations(document: vscode.TextDocument, decorations: DecorationEntry[]): void {
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === document.uri.toString()
  );
  for (const dec of decorations) {
    dec.type.dispose();
    for (const editor of editors) {
      editor.setDecorations(dec.type, []);
    }
  }
  decorations.length = 0;
}

function throttledScan(document: vscode.TextDocument, delay = 500): void {
  const key = document.uri.toString();
  const existing = throttleTimers.get(key);
  if (existing) { clearTimeout(existing); }
  throttleTimers.set(key, setTimeout(() => {
    throttleTimers.delete(key);
    scanDocument(document);
  }, delay));
}

// ─── Hover Provider ─────────────────────────────────────────────────

const hoverProvider: vscode.HoverProvider = {
  async provideHover(document, position) {
    const key = document.uri.toString();
    const result = scanResults.get(key);
    if (!result) { return; }

    const maxHeight = getConfig(document, 'imagePreviewMaxHeight', 100);
    const maxWidth = getConfig(document, 'imagePreviewMaxWidth', -1);

    for (const entry of result.decorations) {
      const match = entry.decorations.find((d) => {
        const fullRange = new vscode.Range(
          d.range.start.line, 0,
          d.range.start.line, document.lineAt(d.range.start.line).text.length
        );
        return fullRange.contains(position);
      });

      if (!match) { continue; }

      const imgPath = entry.imagePath;
      const isLocal = isLocalFile(imgPath) && !isDataUri(imgPath);

      const imgSizeAttr = maxWidth > 0
        ? `width="${maxWidth}"`
        : maxHeight > 0
          ? `height="${maxHeight}"`
          : '';

      const displayPath = isLocal
        ? vscode.Uri.file(imgPath).toString()
        : imgPath;

      // Build hover using Markdown + minimal HTML (VS Code sanitizes most CSS)
      let md = '';

      // Centered image
      md += `<p align="center"><img src="${displayPath}" ${imgSizeAttr}/></p>`;

      // Metadata row: dimensions (left) | format + file size (right)
      if (isLocal) {
        const meta = await getImageMeta(imgPath);
        const left = meta.dimensions ?? '';
        const rightParts = [meta.format, meta.fileSize].filter(Boolean);
        const right = rightParts.join(' · ');
        if (left || right) {
          md += `\n\n<table width="100%"><tr>`;
          md += `<td align="left">${left}</td>`;
          md += `<td align="right">${right}</td>`;
          md += `</tr></table>`;
        }
      }

      // Action links row — bottom
      if (isLocal) {
        const fileUri = vscode.Uri.file(imgPath);
        const args = encodeURIComponent(JSON.stringify([fileUri]));
        md += `\n\n`;
        md += `[Reveal img](command:revealInExplorer?${args})`;
        md += ` · `;
        md += `[Open Folder](command:revealFileInOS?${args})`;
        md += ` · `;
        md += `[$(link-external)](command:vscode.open?${args})`;
      }

      const contents = new vscode.MarkdownString(md);
      contents.isTrusted = true;
      contents.supportHtml = true;
      contents.supportThemeIcons = true;
      return new vscode.Hover(contents, entry.decorations[0].range);
    }

    return undefined;
  },
};

// ─── Activate ───────────────────────────────────────────────────────

export function activateImagePreview(context: vscode.ExtensionContext): void {
  // Hover
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: '*', language: '*' }, hoverProvider)
  );

  // Events
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document) { throttledScan(e.document); }
    }),
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e?.document) { throttledScan(e.document); }
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (e.textEditor?.document) { throttledScan(e.textEditor.document, 100); }
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      throttledScan(doc);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      for (const editor of vscode.window.visibleTextEditors) {
        throttledScan(editor.document);
      }
    }),
    // Invalidate caches when an image file is saved externally
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const ext = doc.fileName.substring(doc.fileName.lastIndexOf('.')).toLowerCase();
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        invalidateMetaCache(doc.fileName);
        invalidateResolveCacheFor(doc.fileName);
      }
    }),
    // Re-scan all visible editors when config changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('atm.image.preview')) {
        for (const editor of vscode.window.visibleTextEditors) {
          throttledScan(editor.document, 100);
        }
      }
    }),
  );

  // Periodic cache cleanup (every 30 s)
  const cacheInterval = setInterval(() => {
    pruneMetaCache();
    pruneResolveCache();
  }, 30_000);

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose() {
      clearInterval(cacheInterval);
      for (const [, entry] of scanResults) {
        entry.token.cancel();
        for (const dec of entry.decorations) { dec.type.dispose(); }
      }
      scanResults.clear();
      for (const timer of throttleTimers.values()) { clearTimeout(timer); }
      throttleTimers.clear();
    },
  });

  // Initial scan
  for (const editor of vscode.window.visibleTextEditors) {
    throttledScan(editor.document, 200);
  }
}

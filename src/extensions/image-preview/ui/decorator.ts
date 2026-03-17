import * as vscode from 'vscode';
import { recognizers, markdownRecognizers } from '../core/recognizers';
import { mappers } from '../core/mappers';
import { getConfig } from '../core/config';
import {
  getImageMeta, isLocalFile, isDataUri,
  getCachedResolution, setCachedResolution,
  pruneMetaCache, pruneResolveCache,
  invalidateMetaCache, invalidateResolveCacheFor,
} from '../core/utils';
import type { ImageMeta } from '../core/utils';
import { ACCEPTED_EXTENSIONS } from '../core/types';
import type { DecorationEntry, ImageInfo } from '../core/types';

/** Scan results per document URI */
const scanResults = new Map<string, {
  decorations: DecorationEntry[];
  token: vscode.CancellationTokenSource;
}>();

/** Reusable decoration types keyed by image+style to reduce churn on rescans. */
const DECORATION_CACHE_TTL = 60_000;
const decorationTypeCache = new Map<string, {
  type: vscode.TextEditorDecorationType;
  refs: number;
  lastUsed: number;
}>();

/** Throttle timers per document URI */
const throttleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Quick-reject heuristic: skip lines that can't possibly contain an image reference.
// This avoids running all recognizer regexes on every line.
const IMAGE_SIGNAL_PATTERN = /\.(svg|png|jpe?g|bmp|gif|ico|webp|avif|jfif)\b|data:image|https?:\/\/|!\[/i;
const DEFAULT_EXCLUDED_FILE_PATTERNS = [
  '.env*',
  '.envrc',
  '.secrets',
  '.secret',
  '.credentials',
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.git-credentials',
];

function escapeRegExp(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/').trim();
  const source = `^${normalized
    .split('*')
    .map((segment) => escapeRegExp(segment).replace(/\\\?/g, '.'))
    .join('.*')}$`;
  return new RegExp(source, 'i');
}

function shouldExcludeDocument(document: vscode.TextDocument): boolean {
  const configuredPatterns = getConfig(document, 'excludeFilePatterns', DEFAULT_EXCLUDED_FILE_PATTERNS);
  const patterns = Array.isArray(configuredPatterns)
    ? configuredPatterns.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : DEFAULT_EXCLUDED_FILE_PATTERNS;

  if (patterns.length === 0) { return false; }

  const fileName = document.fileName.split(/[\\/]/).pop() ?? '';
  const relativePath = vscode.workspace.asRelativePath(document.uri, false).replace(/\\/g, '/');
  const normalizedFilePath = document.fileName.replace(/\\/g, '/');

  for (const pattern of patterns) {
    const regex = globToRegExp(pattern);
    if (regex.test(fileName) || regex.test(relativePath) || regex.test(normalizedFilePath)) {
      return true;
    }
  }

  return false;
}

function hasAcceptedImageExtension(source: string): boolean {
  if (isDataUri(source)) { return true; }
  const withoutQueryOrHash = source.split(/[?#]/, 1)[0].toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => withoutQueryOrHash.endsWith(ext));
}

function isKnownMarkdownImageUrl(source: string): boolean {
  try {
    const parsed = new URL(source);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Shields badge URLs render image content without file extension.
    if (host === 'img.shields.io' && pathname.startsWith('/badge/')) {
      return true;
    }
  } catch {
    // Not a valid URL; ignore and fall back to extension checks.
  }

  return false;
}

function toDecorationCacheKey(imagePath: string, underline: boolean): string {
  return `g|${imagePath}`;
}

function acquireDecorationType(cacheKey: string, uri: vscode.Uri): vscode.TextEditorDecorationType {
  const cached = decorationTypeCache.get(cacheKey);
  const now = Date.now();
  if (cached) {
    cached.refs += 1;
    cached.lastUsed = now;
    return cached.type;
  }

  const created = vscode.window.createTextEditorDecorationType({
    gutterIconPath: uri,
    gutterIconSize: 'contain',
    textDecoration: 'none',
  });

  decorationTypeCache.set(cacheKey, {
    type: created,
    refs: 1,
    lastUsed: now,
  });

  return created;
}

const underlineDecorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline',
});

function releaseDecorationType(cacheKey: string | undefined): void {
  if (!cacheKey) { return; }
  const cached = decorationTypeCache.get(cacheKey);
  if (!cached) { return; }
  cached.refs = Math.max(0, cached.refs - 1);
  cached.lastUsed = Date.now();
}

function pruneDecorationTypeCache(): void {
  const now = Date.now();
  for (const [key, entry] of decorationTypeCache) {
    if (entry.refs === 0 && now - entry.lastUsed >= DECORATION_CACHE_TTL) {
      entry.type.dispose();
      decorationTypeCache.delete(key);
    }
  }
}

// =========================================================
// 🚀 CORE SCANNING LOGIC
// =========================================================

async function scanDocument(document: vscode.TextDocument): Promise<void> {
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === document.uri.toString()
  );
  if (editors.length === 0) { return; }

  const key = document.uri.toString();
  const prev = scanResults.get(key);

  if (shouldExcludeDocument(document)) {
    if (prev) {
      prev.token.cancel();
      clearDecorations(document, prev.decorations);
      scanResults.delete(key);
    }
    return;
  }

  const showGutter = getConfig(document, 'showImagePreviewOnGutter', true);
  const underline = getConfig(document, 'showUnderline', true);
  const isMarkdown = document.languageId === 'markdown';
  const activeRecognizers = isMarkdown ? markdownRecognizers : recognizers;

  // Collect visible line indices
  const visibleLines = new Set<number>();
  for (const editor of editors) {
    for (const range of editor.visibleRanges) {
      for (let i = range.start.line; i <= range.end.line; i++) {
        visibleLines.add(i);
      }
    }
  }

  // Cancel previous scan but keep old decorations visible during re-scan
  const oldDecorations = prev ? [...prev.decorations] : [];
  if (prev) {
    prev.token.cancel();
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

    for (const recognizer of activeRecognizers) {
      const matches = recognizer.recognize(lineIndex, lineText);
      for (const match of matches) {
        // Try resolution cache first
        const cacheKey = `${document.fileName}|${match.url}|${workspaceFolder ?? ''}`;
        const cached = getCachedResolution(cacheKey);
        let resolved: string | undefined;
        if (cached !== null) {
          resolved = cached;
        } else {
          // Not cached – resolve through async mappers
          for (const mapper of mappers) {
            resolved = await mapper.map(document.fileName, match.url, workspaceFolder);
            if (resolved) { break; }
          }
          setCachedResolution(cacheKey, resolved);
        }

        if (!resolved) { continue; }

        // For markdown, only accept obvious image paths/data URIs.
        if (isMarkdown && !hasAcceptedImageExtension(resolved) && !isKnownMarkdownImageUrl(resolved)) { continue; }

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
  const gutterByType = new Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>();

  for (const img of unique) {
    const uri = img.imagePath.startsWith('data:')
      ? vscode.Uri.parse(img.imagePath)
      : img.imagePath.startsWith('http')
        ? vscode.Uri.parse(img.imagePath)
        : vscode.Uri.file(img.imagePath.replace(/\\/g, '/'));

    const cacheKey = toDecorationCacheKey(img.imagePath, underline);
    const decorationType = acquireDecorationType(cacheKey, uri);

    const hoverDecoration: vscode.DecorationOptions = {
      range: img.range,
      hoverMessage: '',
    };

    entry.decorations.push({
      cacheKey,
      type: decorationType,
      decorations: [hoverDecoration],
      originalImagePath: img.originalImagePath,
      imagePath: img.imagePath,
    });

    if (showGutter) {
      const gutterDecoration: vscode.DecorationOptions = {
        range: new vscode.Range(img.range.start, img.range.start),
        hoverMessage: '',
      };
      if (!gutterByType.has(decorationType)) {
        gutterByType.set(decorationType, []);
      }
      gutterByType.get(decorationType)!.push(gutterDecoration);
    }
  }

  // Apply all gutter decorations at once per type
  for (const [type, decorations] of gutterByType) {
    for (const editor of editors) {
      editor.setDecorations(type, decorations);
    }
  }

  if (underline) {
    const underlineDecorations: vscode.DecorationOptions[] = unique.map((img) => ({
      range: img.range,
      hoverMessage: '',
    }));
    for (const editor of editors) {
      editor.setDecorations(underlineDecorationType, underlineDecorations);
    }
  } else {
    for (const editor of editors) {
      editor.setDecorations(underlineDecorationType, []);
    }
  }

  // Clean up old decoration types that are no longer active
  const newCacheKeys = new Set(entry.decorations.map(d => d.cacheKey).filter(Boolean));
  for (const oldDec of oldDecorations) {
    if (oldDec.cacheKey && !newCacheKeys.has(oldDec.cacheKey)) {
      for (const editor of editors) {
        editor.setDecorations(oldDec.type, []);
      }
    }
    releaseDecorationType(oldDec.cacheKey);
  }
}

function clearDecorations(document: vscode.TextDocument, decorations: DecorationEntry[]): void {
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === document.uri.toString()
  );
  for (const dec of decorations) {
    for (const editor of editors) {
      editor.setDecorations(dec.type, []);
    }
    releaseDecorationType(dec.cacheKey);
  }
  for (const editor of editors) {
    editor.setDecorations(underlineDecorationType, []);
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

/**
 * Re-apply existing cached decorations to current editor instances immediately.
 * Used when switching tabs — VS Code may create new editor instances that need
 * the decorations re-applied without waiting for a full re-scan.
 */
function reapplyDecorations(document: vscode.TextDocument): void {
  const key = document.uri.toString();
  const prev = scanResults.get(key);
  if (!prev || prev.decorations.length === 0) { return; }

  const editors = vscode.window.visibleTextEditors.filter(
    (e) => e.document.uri.toString() === key
  );
  if (editors.length === 0) { return; }

  const showGutter = getConfig(document, 'showImagePreviewOnGutter', true);
  const underline = getConfig(document, 'showUnderline', true);

  // Group gutter decorations by type to apply all at once
  const gutterByType = new Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>();
  for (const entry of prev.decorations) {
    if (showGutter && entry.decorations.length > 0) {
      const gutterDec: vscode.DecorationOptions = {
        range: new vscode.Range(entry.decorations[0].range.start, entry.decorations[0].range.start),
        hoverMessage: '',
      };
      if (!gutterByType.has(entry.type)) {
        gutterByType.set(entry.type, []);
      }
      gutterByType.get(entry.type)!.push(gutterDec);
    }
  }

  for (const [type, decorations] of gutterByType) {
    for (const editor of editors) {
      editor.setDecorations(type, decorations);
    }
  }

  if (underline) {
    const underlineDecos: vscode.DecorationOptions[] = prev.decorations
      .filter(e => e.decorations.length > 0)
      .map(e => ({ range: e.decorations[0].range, hoverMessage: '' }));
    for (const editor of editors) {
      editor.setDecorations(underlineDecorationType, underlineDecos);
    }
  }
}

// =========================================================
// 🖱️ HOVER PROVIDER
// =========================================================

function buildHoverMarkdown(
  displayPath: string,
  imgSizeAttr: string,
  meta: ImageMeta | undefined,
  isLocal: boolean,
  imgPath: string,
): string {
  const lines: string[] = [];

  // ── Image preview ──
  lines.push(`<p align="center"><img src="${displayPath}" ${imgSizeAttr}/></p>`);

  // ── Metadata chips ──
  if (meta && (meta.dimensions || meta.fileSize || meta.format)) {
    const chips: string[] = [];

    if (meta.format) {
      chips.push(`\`${meta.format}\``);
    }
    if (meta.dimensions) {
      chips.push(`📐 ${meta.dimensions}px`);
    }
    if (meta.fileSize) {
      chips.push(`💾 ${meta.fileSize}`);
    }

    lines.push('');
    lines.push(chips.join(' &nbsp;·&nbsp; '));
  }

  // ── Action bar ──
  if (isLocal) {
    const fileUri = vscode.Uri.file(imgPath);
    const args = encodeURIComponent(JSON.stringify([fileUri]));

    lines.push('');
    lines.push('---');
    lines.push('');

    const actions: string[] = [
      `[$(folder) Folder](command:revealFileInOS?${args} "Reveal in OS file manager")`,
      `[$(file-symlink-directory) Explorer](command:revealInExplorer?${args} "Reveal in VS Code Explorer")`,
      `[$(link-external) Open](command:vscode.open?${args} "Open in default application")`,
    ];

    lines.push(actions.join(' &nbsp;&nbsp; '));
  } else if (!isDataUri(imgPath)) {
    // Remote URL — show a subtle note
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`$(globe) &nbsp;Remote Image`);
  }

  return lines.join('\n');
}

const hoverProvider: vscode.HoverProvider = {
  async provideHover(document, position) {
    // Markdown already has native link hovers; keep extension hover disabled there.
    if (document.languageId === 'markdown') { return undefined; }
    if (shouldExcludeDocument(document)) { return undefined; }

    const key = document.uri.toString();
    const result = scanResults.get(key);
    if (!result) { return; }

    const maxHeight = getConfig(document, 'imagePreviewMaxHeight', 100);
    const maxWidth = getConfig(document, 'imagePreviewMaxWidth', -1);

    for (const entry of result.decorations) {
      const match = entry.decorations.find((d) => d.range.contains(position));
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

      // Fetch metadata once (cached)
      const meta = isLocal ? await getImageMeta(imgPath) : undefined;

      const md = buildHoverMarkdown(displayPath, imgSizeAttr, meta, isLocal, imgPath);

      const contents = new vscode.MarkdownString(md);
      contents.isTrusted = true;
      contents.supportHtml = true;
      contents.supportThemeIcons = true;
      return new vscode.Hover(contents, entry.decorations[0].range);
    }

    return undefined;
  },
};

// =========================================================
// 🔌 ACTIVATE
// =========================================================

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
      if (e?.document) {
        reapplyDecorations(e.document);
        throttledScan(e.document);
      }
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
    pruneDecorationTypeCache();
  }, 30_000);

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose() {
      clearInterval(cacheInterval);
      for (const [, entry] of scanResults) {
        entry.token.cancel();
        for (const dec of entry.decorations) { releaseDecorationType(dec.cacheKey); }
      }
      scanResults.clear();
      for (const [, cached] of decorationTypeCache) {
        cached.type.dispose();
      }
      decorationTypeCache.clear();
      underlineDecorationType.dispose();
      for (const timer of throttleTimers.values()) { clearTimeout(timer); }
      throttleTimers.clear();
    },
  });

  // Initial scan
  for (const editor of vscode.window.visibleTextEditors) {
    throttledScan(editor.document, 200);
  }
}

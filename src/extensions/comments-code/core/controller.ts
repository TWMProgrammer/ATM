import * as vscode from 'vscode';
import { defaultTags, CommentTag } from '../ui/styles';
import { Decorator } from '../ui/decorator';
import { getLanguageConfig, LanguageConfig } from './languages';

/* =========================================================
 * 🛠️ HELPERS
 * ========================================================= */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* =========================================================
 * 🏷️ TYPES
 * ========================================================= */

interface BlockRegion {
  spanStart: number; // position of "/*" opener (or 0 when continuing from previous line)
  spanEnd: number; // position after "*/" closer (or text.length when extending to next line)
  contentStart: number; // first char of comment body (after "/*")
  contentEnd: number; // last char of comment body (before "*/")
}

interface LineCacheEntry {
  text: string;
  inBlockAtStart: boolean;
  inBlockAtEnd: boolean;
  ranges: Map<string, vscode.DecorationOptions[]>;
}

/* =========================================================
 * 🧠 CONTROLLER
 * ========================================================= */

export class CommentsCodeController {
  private editTimeout: NodeJS.Timeout | undefined;
  private scrollTimeout: NodeJS.Timeout | undefined;
  private decorator: Decorator;

  // P2: per-line cache
  private lineCache = new Map<number, LineCacheEntry>();
  private cachedDocUri = ''; // R5: track active document URI

  // P3: compiled tag index
  private lineTagRegex: RegExp | null = null;
  private wordTagRegex: RegExp | null = null; // R2: compiled word tag regex
  private tagByText = new Map<string, CommentTag>();

  constructor() {
    this.decorator = new Decorator();
    this.decorator.initializeTags(defaultTags);
    this.buildTagIndex(defaultTags);
  }

  /* =========================================================
   * ⚡ INDEX BUILDER
   * Build compiled regex + O(1) lookup map
   * ========================================================= */
  private buildTagIndex(tags: CommentTag[]) {
    this.tagByText.clear();
    for (const tag of tags) {
      this.tagByText.set(tag.text, tag);
    }
    // Sort longer patterns first so "////" beats "/" etc.
    const lineTexts = tags
      .filter((t) => t.type === 'line')
      .map((t) => t.text)
      .sort((a, b) => b.length - a.length);

    this.lineTagRegex =
      lineTexts.length > 0
        ? new RegExp(`^(?:${lineTexts.map(escapeRegex).join('|')})`)
        : null;

    // R4: Pre-filter word tags into separate array
    const wordTags = tags.filter((t) => t.type === 'word');

    // R2: Compiled word tag regex for single-pass scanning
    const wordTexts = wordTags
      .map((t) => t.text)
      .sort((a, b) => b.length - a.length);
    this.wordTagRegex =
      wordTexts.length > 0
        ? new RegExp(wordTexts.map(escapeRegex).join('|'), 'g')
        : null;
  }

  /* =========================================================
   * ⏱️ EDIT DEBOUNCE (300ms)
   * ========================================================= */

  public triggerUpdateDecorations(
    document: vscode.TextDocument,
    immediate = false,
  ) {
    if (this.editTimeout) {
      clearTimeout(this.editTimeout);
      this.editTimeout = undefined;
    }
    if (immediate) {
      this.updateDecorations(document);
    } else {
      this.editTimeout = setTimeout(
        () => this.updateDecorations(document),
        300,
      );
    }
  }

  /* =========================================================
   * 📜 SCROLL DEBOUNCE (50ms)
   * ========================================================= */

  public triggerScrollUpdate(document: vscode.TextDocument) {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = undefined;
    }
    this.scrollTimeout = setTimeout(() => this.updateDecorations(document), 50);
  }

  /* =========================================================
   * ♻️ CACHE INVALIDATION
   * Partial cache invalidation: only from earliest changed line
   * ========================================================= */
  public handleContentChanges(
    changes: readonly vscode.TextDocumentContentChangeEvent[],
  ) {
    if (changes.length === 0) {
      return;
    }

    let earliestLine = Infinity;
    for (const change of changes) {
      earliestLine = Math.min(earliestLine, change.range.start.line);
    }

    const toDelete: number[] = [];
    for (const lineNum of this.lineCache.keys()) {
      if (lineNum >= earliestLine) {
        toDelete.push(lineNum);
      }
    }
    for (const lineNum of toDelete) {
      this.lineCache.delete(lineNum);
    }
    
    // Prevent infinite growth on massive files
    if (this.lineCache.size > 5000) {
      this.lineCache.clear();
    }
  }

  /* =========================================================
   * 🚀 MAIN UPDATE
   * ========================================================= */

  private updateDecorations(document: vscode.TextDocument) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document !== document) {
      return;
    }

    const langConfig = getLanguageConfig(document.languageId);
    if (!langConfig) {
      return;
    }

    // R5: Clear cache when switching documents
    const docUri = document.uri.toString();
    if (docUri !== this.cachedDocUri) {
      this.lineCache.clear();
      this.cachedDocUri = docUri;
    }

    const rangesToDecorate = new Map<string, vscode.DecorationOptions[]>();

    const extraLines = 50;

    for (const visibleRange of activeEditor.visibleRanges) {
      const startLine = Math.max(0, visibleRange.start.line - extraLines);
      const endLine = Math.min(
        document.lineCount - 1,
        visibleRange.end.line + extraLines,
      );

      // P4: Determine block-comment state just before startLine
      let inBlock =
        langConfig.blockStart && langConfig.blockEnd
          ? this.getBlockStateAt(document, startLine, langConfig)
          : false;

      for (let i = startLine; i <= endLine; i++) {
        const { text } = document.lineAt(i);

        // P2: Cache hit?
        const cached = this.lineCache.get(i);
        if (
          cached &&
          cached.text === text &&
          cached.inBlockAtStart === inBlock
        ) {
          for (const [tagText, ranges] of cached.ranges) {
            if (ranges.length > 0) {
              let arr = rangesToDecorate.get(tagText);
              if (!arr) { arr = []; rangesToDecorate.set(tagText, arr); }
              arr.push(...ranges);
            }
          }
          inBlock = cached.inBlockAtEnd;
          continue;
        }

        // Fresh parse
        const lineRanges = new Map<string, vscode.DecorationOptions[]>();

        const inBlockAtStart = inBlock;
        inBlock = this.processLine(i, text, langConfig, inBlock, lineRanges);

        // P2: Store in cache
        this.lineCache.set(i, {
          text,
          inBlockAtStart,
          inBlockAtEnd: inBlock,
          ranges: lineRanges,
        });

        for (const [tagText, ranges] of lineRanges) {
          if (ranges.length > 0) {
            let arr = rangesToDecorate.get(tagText);
            if (!arr) { arr = []; rangesToDecorate.set(tagText, arr); }
            arr.push(...ranges);
          }
        }
      }
    }

    this.decorator.applyDecorations(activeEditor, rangesToDecorate);
  }

  /* =========================================================
   * 🧩 LINE PROCESSOR
   * Process one line, returns updated inBlock state
   * ========================================================= */

  private isInsideString(text: string, pos: number): boolean {
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escape = false;

    for (let i = 0; i < pos; i++) {
      const c = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
      else if (c === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
      else if (c === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    }
    return inSingle || inDouble || inTemplate;
  }

  private processLine(
    lineIndex: number,
    text: string,
    langConfig: LanguageConfig,
    inBlock: boolean,
    lineRanges: Map<string, vscode.DecorationOptions[]>,
  ): boolean {
    // Step 1 — build block comment regions for this line
    const blockRegions: BlockRegion[] = [];
    let pos = 0;

    if (langConfig.blockStart && langConfig.blockEnd) {
      const bs = langConfig.blockStart;
      const be = langConfig.blockEnd;

      if (inBlock) {
        // Line starts inside an already-open block comment
        const beIdx = text.indexOf(be, 0);
        if (beIdx === -1) {
          blockRegions.push({
            spanStart: 0,
            spanEnd: text.length,
            contentStart: 0,
            contentEnd: text.length,
          });
          pos = text.length; // entire line is block content
        } else {
          blockRegions.push({
            spanStart: 0,
            spanEnd: beIdx + be.length,
            contentStart: 0,
            contentEnd: beIdx,
          });
          inBlock = false;
          pos = beIdx + be.length;
        }
      }

      // Scan for new block comments opening on this line
      while (pos < text.length) {
        let bsIdx = text.indexOf(bs, pos);
        // Ignore block starts if they are inside strings
        while (bsIdx !== -1 && this.isInsideString(text, bsIdx)) {
           bsIdx = text.indexOf(bs, bsIdx + bs.length);
        }
        if (bsIdx === -1) {
          break;
        }
        const contentStart = bsIdx + bs.length;
        const beIdx = text.indexOf(be, contentStart);

        if (beIdx === -1) {
          blockRegions.push({
            spanStart: bsIdx,
            spanEnd: text.length,
            contentStart,
            contentEnd: text.length,
          });
          inBlock = true;
          pos = text.length;
        } else {
          blockRegions.push({
            spanStart: bsIdx,
            spanEnd: beIdx + be.length,
            contentStart,
            contentEnd: beIdx,
          });
          inBlock = false;
          pos = beIdx + be.length;
        }
      }
    }

    // Helper: true when a char index falls within any block comment span
    const isInBlock = (charPos: number): boolean =>
      blockRegions.some((r) => charPos >= r.spanStart && charPos < r.spanEnd);

    // Step 2 — single-line comment
    if (langConfig.singleLine) {
      const slStr = langConfig.singleLine;
      let slIdx = text.indexOf(slStr);
      let isValidSingleLine = false;

      while (slIdx !== -1) {
        // Must not be in block comment, not inside string on this line, and not part of a URL (://)
        if (!isInBlock(slIdx) && !this.isInsideString(text, slIdx) && !(slIdx > 0 && text[slIdx - 1] === ':')) {
          isValidSingleLine = true;
          break;
        }
        slIdx = text.indexOf(slStr, Math.max(slIdx + 1, slIdx + slStr.length));
      }

      if (isValidSingleLine) {
        const afterMarker = text.substring(
          slIdx + slStr.length,
        );
        const trimmed = afterMarker.trimStart();

        // P3: compiled regex for line-type tags
        const lineMatch = this.lineTagRegex?.exec(trimmed);
        if (lineMatch) {
          const tag = this.tagByText.get(lineMatch[0]);
          if (tag?.type === 'line') {
            const startChar = slIdx;
            let arr = lineRanges.get(tag.text);
            if (!arr) { arr = []; lineRanges.set(tag.text, arr); }
            arr.push({
              range: new vscode.Range(
                new vscode.Position(lineIndex, startChar),
                new vscode.Position(lineIndex, text.length),
              ),
            });
          }
        } else {
          // Word-type tags inside single-line comment
          this.findWordTags(
            lineIndex,
            slIdx,
            text.substring(slIdx),
            lineRanges,
          );
        }
      }
    }

    // Step 3 — P4: process each block comment region
    for (const region of blockRegions) {
      const content = text.substring(region.contentStart, region.contentEnd);
      const trimmed = content.trimStart();

      // Line-type tag inside block comment
      const lineMatch = this.lineTagRegex?.exec(trimmed);
      if (lineMatch) {
        const tag = this.tagByText.get(lineMatch[0]);
        if (tag?.type === 'line') {
          const startChar = region.spanStart;
          let arr = lineRanges.get(tag.text);
          if (!arr) { arr = []; lineRanges.set(tag.text, arr); }
          arr.push({
            range: new vscode.Range(
              new vscode.Position(lineIndex, startChar),
              new vscode.Position(lineIndex, region.spanEnd),
            ),
          });
          continue;
        }
      }

      // Word-type tags inside block comment
      this.findWordTags(lineIndex, region.contentStart, content, lineRanges);
    }

    return inBlock;
  }

  /* =========================================================
   * 🔎 WORD TAG SCANNER
   * Compiled regex, single-pass scanner
   * ========================================================= */

  private findWordTags(
    lineIndex: number,
    offset: number,
    content: string,
    lineRanges: Map<string, vscode.DecorationOptions[]>,
  ) {
    if (!this.wordTagRegex) {
      return;
    }

    this.wordTagRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = this.wordTagRegex.exec(content)) !== null) {
      const matchIdx = match.index;
      const matchText = match[0];

      // Word boundary check
      const before = matchIdx > 0 ? content[matchIdx - 1] : ' ';
      const after = content[matchIdx + matchText.length] ?? ' ';
      if (/[\w]/.test(before) || /[\w]/.test(after)) {
        continue;
      }

      const absIdx = offset + matchIdx;
      let arr = lineRanges.get(matchText);
      if (!arr) { arr = []; lineRanges.set(matchText, arr); }
      arr.push({
        range: new vscode.Range(
          new vscode.Position(lineIndex, absIdx),
          new vscode.Position(lineIndex, absIdx + matchText.length),
        ),
      });
    }
  }

  /* =========================================================
   * 🧱 BLOCK STATE RESOLVER
   * ========================================================= */

  /**
   * Returns the inBlock state at the START of `lineIndex`.
   * Uses the line cache when available; falls back to a bounded backward scan.
   */
  private getBlockStateAt(
    document: vscode.TextDocument,
    lineIndex: number,
    langConfig: LanguageConfig,
  ): boolean {
    if (!langConfig.blockStart || !langConfig.blockEnd) {
      return false;
    }

    // Walk backwards through the cache to find the closest known state (up to 2500 lines)
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 2500); i--) {
      const cached = this.lineCache.get(i);
      if (cached) {
        // Start from cached inBlockAtEnd and scan forward to lineIndex
        let state = cached.inBlockAtEnd;
        for (let j = i + 1; j < lineIndex; j++) {
          state = this.stepBlockState(
            document.lineAt(j).text,
            state,
            langConfig.blockStart,
            langConfig.blockEnd,
          );
        }
        return state;
      }
    }

    // No cache: bounded scan from at most 2500 lines back to ensure block capturing
    const scanFrom = Math.max(0, lineIndex - 2500);
    let state = false;
    for (let i = scanFrom; i < lineIndex; i++) {
      state = this.stepBlockState(
        document.lineAt(i).text,
        state,
        langConfig.blockStart,
        langConfig.blockEnd,
      );
    }
    return state;
  }

  /** Compute the inBlock state at the END of one line. */
  private stepBlockState(
    text: string,
    inBlock: boolean,
    blockStart: string,
    blockEnd: string,
  ): boolean {
    let pos = 0;
    while (pos < text.length) {
      if (!inBlock) {
        const bsIdx = text.indexOf(blockStart, pos);
        if (bsIdx === -1) {
          break;
        }
        inBlock = true;
        pos = bsIdx + blockStart.length;
      } else {
        const beIdx = text.indexOf(blockEnd, pos);
        if (beIdx === -1) {
          break;
        }
        inBlock = false;
        pos = beIdx + blockEnd.length;
      }
    }
    return inBlock;
  }

  /* =========================================================
   * ⚙️ COMMANDS & LIFECYCLE
   * ========================================================= */

  public dispose() {
    if (this.editTimeout) {
      clearTimeout(this.editTimeout);
      this.editTimeout = undefined;
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = undefined;
    }
    this.decorator.dispose();
  }
}

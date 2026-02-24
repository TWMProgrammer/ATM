import * as vscode from 'vscode';
import { defaultTags, CommentTag } from '../ui/styles';
import { Decorator } from '../ui/decorator';
import { getLanguageConfig, LanguageConfig } from './languages';

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Controller ──────────────────────────────────────────────────────────────

export class CommentsCodeController {
  private editTimeout: NodeJS.Timeout | undefined;
  private scrollTimeout: NodeJS.Timeout | undefined;
  private decorator: Decorator;

  // P2: per-line cache
  private lineCache = new Map<number, LineCacheEntry>();
  private cachedDocVersion = -1;
  private cachedDocUri = ''; // R5: track active document URI

  // P3: compiled tag index
  private lineTagRegex: RegExp | null = null;
  private wordTagRegex: RegExp | null = null; // R2: compiled word tag regex
  private tagByText = new Map<string, CommentTag>();
  private wordTags: CommentTag[] = []; // R4: pre-filtered word tags

  constructor() {
    this.decorator = new Decorator();
    this.decorator.initializeTags(defaultTags);
    this.buildTagIndex(defaultTags);
  }

  // P3: Build compiled regex + O(1) lookup map
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
    this.wordTags = tags.filter((t) => t.type === 'word');

    // R2: Compiled word tag regex for single-pass scanning
    const wordTexts = this.wordTags
      .map((t) => t.text)
      .sort((a, b) => b.length - a.length);
    this.wordTagRegex =
      wordTexts.length > 0
        ? new RegExp(wordTexts.map(escapeRegex).join('|'), 'g')
        : null;
  }

  // ─── P1: Edit debounce (300 ms) ──────────────────────────────────────────

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

  // ─── P1: Scroll debounce (50 ms) ─────────────────────────────────────────

  public triggerScrollUpdate(document: vscode.TextDocument) {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = undefined;
    }
    this.scrollTimeout = setTimeout(() => this.updateDecorations(document), 50);
  }

  // R1: Partial cache invalidation — only invalidate from the earliest changed line
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
  }

  // ─── Main update ─────────────────────────────────────────────────────────

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
    // R1: Version tracked for reference (partial invalidation handled by handleContentChanges)
    this.cachedDocVersion = document.version;

    const tags = defaultTags;
    const rangesToDecorate = new Map<string, vscode.DecorationOptions[]>();
    for (const tag of tags) {
      rangesToDecorate.set(tag.text, []);
    }

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
            rangesToDecorate.get(tagText)?.push(...ranges);
          }
          inBlock = cached.inBlockAtEnd;
          continue;
        }

        // Fresh parse
        const lineRanges = new Map<string, vscode.DecorationOptions[]>();
        for (const tag of tags) {
          lineRanges.set(tag.text, []);
        }

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
          rangesToDecorate.get(tagText)?.push(...ranges);
        }
      }
    }

    this.decorator.applyDecorations(activeEditor, rangesToDecorate);
  }

  // ─── P4: Process one line, returns updated inBlock state ─────────────────

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
        const bsIdx = text.indexOf(bs, pos);
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
      const slIdx = text.indexOf(langConfig.singleLine);
      if (slIdx !== -1 && !isInBlock(slIdx)) {
        const afterMarker = text.substring(
          slIdx + langConfig.singleLine.length,
        );
        const trimmed = afterMarker.trimStart();
        const trimOffset = afterMarker.length - trimmed.length;

        // P3: compiled regex for line-type tags
        const lineMatch = this.lineTagRegex?.exec(trimmed);
        if (lineMatch) {
          const tag = this.tagByText.get(lineMatch[0]);
          if (tag?.type === 'line') {
            const startChar = slIdx;
            lineRanges.get(tag.text)?.push({
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
      const trimOffset = content.length - trimmed.length;

      // Line-type tag inside block comment
      const lineMatch = this.lineTagRegex?.exec(trimmed);
      if (lineMatch) {
        const tag = this.tagByText.get(lineMatch[0]);
        if (tag?.type === 'line') {
          const startChar = region.spanStart;
          lineRanges.get(tag.text)?.push({
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

  // ─── R2: Word tag scanner (compiled regex, single-pass) ─────────────────

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
      lineRanges.get(matchText)?.push({
        range: new vscode.Range(
          new vscode.Position(lineIndex, absIdx),
          new vscode.Position(lineIndex, absIdx + matchText.length),
        ),
      });
    }
  }

  // ─── P4: Block state resolver ────────────────────────────────────────────

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

    // Walk backwards through the cache to find the closest known state
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 300); i--) {
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

    // No cache: bounded scan from at most 300 lines back
    const scanFrom = Math.max(0, lineIndex - 300);
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

  // ─── Command & lifecycle ─────────────────────────────────────────────────

  public listAnnotations() {
    vscode.window.showInformationMessage(
      'List annotations command executing! (Placeholder for global workspace search)',
    );
  }

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

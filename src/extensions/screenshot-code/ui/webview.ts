import * as htmlToImage from 'html-to-image';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

interface Config {
  fontLigatures: boolean | string;
  tabSize: number;
  windowTitle: string;
  startLine: number;
  plainText?: string;
}

/* ═══════════════════════════════════════════════
   DOM HELPERS
   ═══════════════════════════════════════════════ */

const $ = (sel: string, ctx: Document | HTMLElement = document) =>
  ctx.querySelector<HTMLElement>(sel);

const $$ = (sel: string, ctx: Document | HTMLElement = document) =>
  Array.from(ctx.querySelectorAll<HTMLElement>(sel));

import { DockWidget } from './widget/dock';

/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */

let isTakingSnapshot = false;
let currentStartLine = 1;
let showLineNumbers = true;

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const snippetNode = $('#snippet-content')!;
  const windowNode = $('#window')!;
  const containerNode = $('#snippet-container')!;
  const titleNode = $('#window-title')!;
  const navbarNode = $('#navbar')!;

  // Initialize Dock Widget
  new DockWidget({
    containerId: 'dock-container',
    snippetContainerId: 'snippet-container',
    windowNodeId: 'window',
    navbarNodeId: 'navbar',
    snippetNodeId: 'snippet-content',
    getCurrentLineNumbersVisible: () => showLineNumbers,
    onToggleLineNumbers: (show: boolean) => {
      showLineNumbers = show;
    },
    onSave: async (btn: HTMLElement) => {
      if (isTakingSnapshot || !containerNode) { return; }
      const originalHTML = btn.innerHTML;
      
      try {
        isTakingSnapshot = true;
        btn.classList.add('loading');
        btn.innerHTML = svgLoading;
        
        // Use a tiny delay to ensure the loading icon paints before heavy work starts
        await new Promise(r => setTimeout(r, 10));

        flashAnimation();

        const scale = 2;
        const dataUrl = await htmlToImage.toPng(containerNode, {
          pixelRatio: scale,
          skipFonts: true,
        });

        vscode.postMessage({
          command: 'saveImage',
          data: dataUrl,
        });

        // Feedback for save - Just revert to original
        btn.classList.remove('loading');
        btn.innerHTML = originalHTML;
      } catch (err: any) {
        btn.classList.remove('loading');
        btn.innerHTML = originalHTML;
        vscode.postMessage({ command: 'error', text: err.message });
      } finally {
        isTakingSnapshot = false;
      }
    },
    onCopy: async (btn: HTMLElement) => {
      if (isTakingSnapshot || !containerNode) { return; }

      const originalHTML = btn.innerHTML;
      try {
        isTakingSnapshot = true;
        
        // Show loading state immediately
        btn.classList.add('loading');
        btn.innerHTML = svgLoading;

        // Use a tiny delay to ensure the loading icon paints before heavy work starts
        await new Promise(r => setTimeout(r, 10));

        const scale = 2;
        const dataUrl = await htmlToImage.toPng(containerNode, {
          pixelRatio: scale,
          skipFonts: true,
        });

        const blob = await (await fetch(dataUrl)).blob();
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);

        // Visual feedback - Success
        btn.classList.remove('loading');
        btn.classList.add('copied');
        btn.innerHTML = svgDoubleCheck;

        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalHTML;
        }, 2000);
      } catch (err: any) {
        btn.classList.remove('loading');
        btn.innerHTML = originalHTML;
        vscode.postMessage({ command: 'error', text: err.message });
      } finally {
        isTakingSnapshot = false;
      }
    }
  });

  /* ─── Receive code update from extension ──── */
  window.addEventListener('message', event => {
    const config = event.data as Config;
    if (event.data.type === 'update') {
      if (titleNode) {
        titleNode.textContent = config.windowTitle || 'code';
      }
      currentStartLine = config.startLine ?? 0;

      // Apply tab size
      if (config.tabSize && snippetNode) {
        snippetNode.style.tabSize = String(config.tabSize);
      }

      // Apply font ligatures
      if (snippetNode) {
        if (config.fontLigatures === true || config.fontLigatures === 'true') {
          snippetNode.style.fontFeatureSettings = '"liga" 1, "calt" 1';
        } else {
          snippetNode.style.fontFeatureSettings = '"liga" 0, "calt" 0';
        }
      }

      // Trigger paste
      let pasteWorked = false;
      const pasteHandler = () => { pasteWorked = true; };
      document.addEventListener('paste', pasteHandler, { once: true });
      document.execCommand('paste');

      setTimeout(() => {
        document.removeEventListener('paste', pasteHandler);
        if (!pasteWorked && config.plainText && snippetNode) {
          snippetNode.innerHTML = config.plainText
            .split('\n')
            .map(l => `<div>${escapeHtml(l) || '&nbsp;'}</div>`)
            .join('');

          const rows = $$(':scope > div', snippetNode);
          rows.forEach((row, idx) => {
            const newRow = document.createElement('div');
            newRow.className = 'line';
            
            const lineNum = document.createElement('div');
            lineNum.className = 'line-number';
            lineNum.textContent = String(currentStartLine + idx + 1);
            if (!showLineNumbers) {
              lineNum.style.display = 'none';
            }

            const lineCodeDiv = document.createElement('div');
            lineCodeDiv.className = 'line-code';
            const lineCode = document.createElement('span');
            lineCode.innerHTML = row.innerHTML;
            lineCodeDiv.appendChild(lineCode);

            newRow.appendChild(lineNum);
            newRow.appendChild(lineCodeDiv);
            row.replaceWith(newRow);
          });
        }
      }, 50);
    }
  });

  /* ─── Handle paste event ──────────────── */
  document.addEventListener('paste', (e) => {
    if (!snippetNode) { return; }

    const htmlData = e.clipboardData?.getData('text/html');
    if (htmlData) {
      snippetNode.innerHTML = htmlData;
    } else {
      const textData = e.clipboardData?.getData('text/plain') || '';
      snippetNode.innerHTML = textData
        .split('\n')
        .map(l => `<div>${escapeHtml(l) || '&nbsp;'}</div>`)
        .join('');
    }

    // Extract original styling from VS Code's pasted div
    const internalDiv = $('div', snippetNode);
    if (internalDiv) {
      snippetNode.style.fontSize = internalDiv.style.fontSize || '';
      snippetNode.style.lineHeight = internalDiv.style.lineHeight || '';
      snippetNode.innerHTML = internalDiv.innerHTML;
    }

    // Convert <br> to empty lines
    $$(':scope > br', snippetNode).forEach(br => {
      br.outerHTML = '<div>&nbsp;</div>';
    });

    const rows = $$(':scope > div', snippetNode);

    // Strip common leading indent
    const regIndent = /^\s+/u;
    const initialSpans = $$(':scope > div > span:first-child', snippetNode);
    if (initialSpans.length > 0 && !initialSpans.some(s => !regIndent.test(s.textContent || ''))) {
      const indents = initialSpans.map(
        s => (s.textContent?.match(regIndent) || [''])[0].length
      );
      const minIndent = Math.min(...indents);
      if (minIndent > 0 && minIndent !== Infinity) {
        initialSpans.forEach(s => {
          s.textContent = s.textContent?.slice(minIndent) || '';
        });
      }
    }

    // Rebuild rows with line numbers
    rows.forEach((row, idx) => {
      const newRow = document.createElement('div');
      newRow.className = 'line';

      const lineNum = document.createElement('div');
      lineNum.className = 'line-number';
      lineNum.textContent = String(currentStartLine + idx + 1);
      if (!showLineNumbers) {
        lineNum.style.display = 'none';
      }

      const lineCodeDiv = document.createElement('div');
      lineCodeDiv.className = 'line-code';
      const lineCode = document.createElement('span');
      lineCode.innerHTML = row.innerHTML;
      lineCodeDiv.appendChild(lineCode);

      newRow.appendChild(lineNum);
      newRow.appendChild(lineCodeDiv);
      row.replaceWith(newRow);
    });
  });

  /* ═══════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════ */

  function flashAnimation() {
    const fx = $('#flash-fx');
    if (fx) {
      fx.style.display = 'block';
      fx.style.opacity = '1';
      requestAnimationFrame(() => {
        setTimeout(() => { fx.style.opacity = '0'; }, 30);
        setTimeout(() => { fx.style.display = 'none'; }, 450);
      });
    }
  }

  function showToast(message: string, type: 'success' | 'info' = 'info') {
    // Remove existing toast
    const existing = $('.toast');
    if (existing) { existing.remove(); }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${type === 'success' ? svgCheck : svgInfo} ${escapeHtml(message)}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 2500);
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});

/* ═══════════════════════════════════════
   SVG ICON STRINGS
   ═══════════════════════════════════════ */

const svgCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const svgDoubleCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;

const svgLoading = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

const svgInfo = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

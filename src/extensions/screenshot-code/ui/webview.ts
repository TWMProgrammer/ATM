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

/* ═══════════════════════════════════════════════
   GRADIENT PRESETS
   ═══════════════════════════════════════════════ */

const GRADIENT_PRESETS = [
  { name: 'Indigo Night', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Ocean Breeze', value: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' },
  { name: 'Sunset Blaze', value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { name: 'Emerald Glow', value: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)' },
  { name: 'Rose Gold', value: 'linear-gradient(135deg, #f43f5e 0%, #d946ef 100%)' },
  { name: 'Midnight Blue', value: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' },
  { name: 'Amber Flame', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { name: 'Slate Mono', value: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' },
];

/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */

let isTakingSnapshot = false;
let currentStartLine = 1;
let showLineNumbers = true;
let showWindowChrome = true;
let showShadow = true;
let currentPadding = 48; // px

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const snippetNode = $('#snippet-content')!;
  const windowNode = $('#window')!;
  const containerNode = $('#snippet-container')!;
  const titleNode = $('#window-title')!;
  const navbarNode = $('#navbar')!;
  const colorPicker = $('#bg-color-picker') as HTMLInputElement;

  /* ─── Gradient presets ────────────────── */
  const presetsContainer = $('#gradient-presets');
  if (presetsContainer) {
    GRADIENT_PRESETS.forEach((preset, i) => {
      const swatch = document.createElement('div');
      swatch.className = `gradient-swatch${i === 0 ? ' active' : ''}`;
      swatch.style.background = preset.value;
      swatch.title = preset.name;
      swatch.addEventListener('click', () => {
        containerNode.style.background = preset.value;
        containerNode.classList.remove('no-bg');
        $$('.gradient-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
      presetsContainer.appendChild(swatch);
    });
  }

  /* ─── Custom colour picker ────────────── */
  if (colorPicker && containerNode) {
    colorPicker.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      containerNode.style.background = color;
      containerNode.classList.remove('no-bg');
      $$('.gradient-swatch').forEach(s => s.classList.remove('active'));
    });
  }

  /* ─── Transparent background toggle ───── */
  $('#btn-toggle-bg')?.addEventListener('click', () => {
    const btn = $('#btn-toggle-bg')!;
    containerNode.classList.toggle('no-bg');
    btn.classList.toggle('active', containerNode.classList.contains('no-bg'));
  });

  /* ─── Shadow toggle ──────────────────── */
  $('#btn-toggle-shadow')?.addEventListener('click', () => {
    const btn = $('#btn-toggle-shadow')!;
    showShadow = !showShadow;
    windowNode.classList.toggle('no-shadow', !showShadow);
    btn.classList.toggle('active', showShadow);
  });

  /* ─── Window chrome toggle ────────────── */
  $('#btn-toggle-chrome')?.addEventListener('click', () => {
    const btn = $('#btn-toggle-chrome')!;
    showWindowChrome = !showWindowChrome;
    navbarNode.classList.toggle('hidden', !showWindowChrome);
    btn.classList.toggle('active', showWindowChrome);
  });

  /* ─── Line numbers toggle ────────────── */
  $('#btn-toggle-lines')?.addEventListener('click', () => {
    const btn = $('#btn-toggle-lines')!;
    showLineNumbers = !showLineNumbers;
    btn.classList.toggle('active', showLineNumbers);
    $$('.line-number', snippetNode).forEach(el => {
      el.style.display = showLineNumbers ? '' : 'none';
    });
  });

  /* ─── Padding slider ─────────────────── */
  const paddingSlider = $('#padding-slider') as HTMLInputElement | null;
  if (paddingSlider) {
    paddingSlider.addEventListener('input', () => {
      currentPadding = parseInt(paddingSlider.value, 10);
      containerNode.style.padding = `${currentPadding}px`;
    });
  }

  /* ─── Save (PNG default) ──────────────── */
  $('#btn-save')?.addEventListener('click', async () => {
    if (isTakingSnapshot || !containerNode) { return; }
    try {
      isTakingSnapshot = true;
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
    } catch (err: any) {
      vscode.postMessage({ command: 'error', text: err.message });
    } finally {
      isTakingSnapshot = false;
    }
  });

  /* ─── Copy to clipboard ───────────────── */
  $('#btn-copy')?.addEventListener('click', async () => {
    if (isTakingSnapshot || !containerNode) { return; }
    const btn = $('#btn-copy')!;

    try {
      isTakingSnapshot = true;

      const scale = 2;
      const dataUrl = await htmlToImage.toPng(containerNode, {
        pixelRatio: scale,
        skipFonts: true,
      });

      const blob = await (await fetch(dataUrl)).blob();
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);

      // Visual feedback
      btn.classList.add('copied');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = svgCheck + ' Copied!';
      showToast('Copied to clipboard!', 'success');

      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalHTML;
      }, 2000);
    } catch (err: any) {
      vscode.postMessage({ command: 'error', text: err.message });
    } finally {
      isTakingSnapshot = false;
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

const svgCheck = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const svgInfo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

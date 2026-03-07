import * as htmlToImage from 'html-to-image';

// Declare VS Code API interface
declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

interface Config {
  fontLigatures: boolean | string;
  tabSize: number;
  windowTitle: string;
  startLine: number;
}

const $ = (selector: string, ctx: Document | HTMLElement = document) =>
  ctx.querySelector<HTMLElement>(selector);
const $$ = (selector: string, ctx: Document | HTMLElement = document) =>
  Array.from(ctx.querySelectorAll<HTMLElement>(selector));

let isTakingSnapshot = false;

document.addEventListener('DOMContentLoaded', () => {
  const snippetNode = $('#snippet-content');
  const windowNode = $('#window');
  const containerNode = $('#snippet-container');
  const titleNode = $('#window-title');
  const colorPicker = $('#bg-color-picker') as HTMLInputElement;

  if (colorPicker && containerNode) {
    colorPicker.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      containerNode.style.setProperty('--container-bg', color);
    });
  }

  $('#btn-save')?.addEventListener('click', async () => {
    if (isTakingSnapshot || !containerNode) { return; }
    try {
      isTakingSnapshot = true;
      flashAnimation();
      
      const dataUrl = await htmlToImage.toJpeg(containerNode, {
        quality: 0.95,
        backgroundColor: "transparent",
        skipFonts: true, // We grab system fonts or what webview has
      });

      vscode.postMessage({
        command: 'saveImage',
        data: dataUrl
      });
    } catch (err: any) {
      vscode.postMessage({ command: 'error', text: err.message });
    } finally {
      isTakingSnapshot = false;
    }
  });

  $('#btn-copy')?.addEventListener('click', async () => {
    if (isTakingSnapshot || !containerNode) { return; }
    
    try {
      isTakingSnapshot = true;
      const dataUrl = await htmlToImage.toPng(containerNode, {
        backgroundColor: "transparent",
        skipFonts: true,
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      
      flashAnimation();
    } catch (err: any) {
      vscode.postMessage({ command: 'error', text: err.message });
    } finally {
      isTakingSnapshot = false;
    }
  });

  window.addEventListener('message', event => {
    const config = event.data as Config;
    if (event.data.type === 'update') {
      if (titleNode) { titleNode.textContent = config.windowTitle || 'code'; }
      
      // Let's pretend to press paste
      document.execCommand('paste');
    }
  });

  document.addEventListener('paste', (e) => {
    if (!snippetNode) { return; }
    const htmlData = e.clipboardData?.getData('text/html');
    if (htmlData) {
      snippetNode.innerHTML = htmlData;
    } else {
      const textData = e.clipboardData?.getData('text/plain') || '';
      snippetNode.innerHTML = textData.split('\n').map(l => `<div>${l}</div>`).join('');
    }
    
    // Attempt to maintain original code's style size
    const internalDiv = $('div', snippetNode);
    if (internalDiv) {
      snippetNode.style.fontSize = internalDiv.style.fontSize;
      snippetNode.style.lineHeight = internalDiv.style.lineHeight;
      snippetNode.innerHTML = internalDiv.innerHTML;
    }

    // Convert br to empty div logic
    $$(':scope > br', snippetNode).forEach(br => { br.outerHTML = '<div>&nbsp;</div>'; });

    const rows = $$(':scope > div', snippetNode);
    
    // strip indent
    const regIndent = /^\\s+/u;
    const initialSpans = $$(':scope > div > span:first-child', snippetNode);
    if (!initialSpans.some(span => !regIndent.test(span.textContent || ''))) {
      const minIndent = Math.min(
        ...initialSpans.map(span => (span.textContent?.match(regIndent) || [''])[0].length)
      );
      if (minIndent > 0 && minIndent !== Infinity) {
        initialSpans.forEach(span => { span.textContent = span.textContent?.slice(minIndent) || ''; });
      }
    }

    rows.forEach((row, idx) => {
      const newRow = document.createElement('div');
      newRow.className = 'line';
      
      const lineNum = document.createElement('div');
      lineNum.className = 'line-number';
      // Fake start block (Wait we need to grab the actual startline from the message)
      lineNum.textContent = String(idx + 1);
      
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

  function flashAnimation() {
    const fx = $('#flash-fx');
    if (fx) {
      fx.style.display = 'block';
      fx.style.opacity = '1';
      setTimeout(() => {
        fx.style.opacity = '0';
      }, 50);
      setTimeout(() => {
        fx.style.display = 'none';
      }, 500);
    }
  }
});

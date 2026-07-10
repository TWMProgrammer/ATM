import type { FromWebviewMessage, ToWebviewMessage } from '../host/messages';
import { vscodeApi } from './vscode-api';

// ======================================
// ATM BROWSER — WEBVIEW UI | MARK: UI
// ======================================
// Paints the CDP screencast onto a canvas and forwards mouse/keyboard input
// back to the headless browser through the extension host.

const backBtn = document.getElementById('nav-back') as HTMLButtonElement;
const forwardBtn = document.getElementById('nav-forward') as HTMLButtonElement;
const reloadBtn = document.getElementById('nav-reload') as HTMLButtonElement;
const externalBtn = document.getElementById('open-external') as HTMLButtonElement;
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const stage = document.getElementById('stage') as HTMLElement;
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;
const overlayText = document.getElementById('overlay-text') as HTMLElement;
const overlayHint = document.getElementById('overlay-hint') as HTMLElement;

const ctx = canvas.getContext('2d');

let currentUrl = '';
let isLoading = false;

function post(message: FromWebviewMessage): void {
  vscodeApi.postMessage(message);
}

// ======================================
// FRAME PAINTING | MARK: FRAMES
// ======================================

let painting = false;
let pendingFrame: string | undefined;

function paintFrame(data: string): void {
  if (!ctx) {
    return;
  }
  if (painting) {
    pendingFrame = data; // keep only the newest frame
    return;
  }
  painting = true;
  const img = new Image();
  img.onload = () => {
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    ctx.drawImage(img, 0, 0);
    painting = false;
    const next = pendingFrame;
    pendingFrame = undefined;
    if (next) {
      paintFrame(next);
    }
  };
  img.onerror = () => {
    painting = false;
  };
  img.src = 'data:image/jpeg;base64,' + data;
}

// ======================================
// STATUS / NAVIGATION STATE | MARK: STATE
// ======================================

function showOverlay(text: string, error: boolean): void {
  overlay.classList.remove('hidden');
  overlay.classList.toggle('error', error);
  overlayText.textContent = text;
  overlayHint.hidden = !error;
  if (error) {
    overlayHint.textContent =
      'Check the "atm.browser.executablePath" setting if your browser was not detected.';
  }
}

function displayUrl(url: string): string {
  return url === 'about:blank' ? '' : url;
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as ToWebviewMessage;
  switch (message.type) {
    case 'status':
      showOverlay(
        message.state === 'launching' ? 'Starting browser…' : message.message ?? 'Browser error',
        message.state === 'error'
      );
      break;
    case 'connected':
      overlay.classList.add('hidden');
      break;
    case 'frame':
      overlay.classList.add('hidden');
      paintFrame(message.data);
      break;
    case 'nav':
      currentUrl = message.url;
      if (document.activeElement !== urlInput) {
        urlInput.value = displayUrl(message.url);
      }
      backBtn.disabled = !message.canGoBack;
      forwardBtn.disabled = !message.canGoForward;
      break;
    case 'loading':
      isLoading = message.value;
      reloadBtn.classList.toggle('loading', isLoading);
      reloadBtn.title = isLoading ? 'Stop loading' : 'Reload';
      break;
    case 'focusUrl':
      urlInput.focus();
      break;
  }
});

// ======================================
// VIEWPORT | MARK: VIEWPORT
// ======================================

let viewportTimer: number | undefined;

function sendViewport(): void {
  post({
    type: 'viewport',
    width: Math.max(100, Math.floor(stage.clientWidth)),
    height: Math.max(100, Math.floor(stage.clientHeight)),
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  });
}

new ResizeObserver(() => {
  window.clearTimeout(viewportTimer);
  viewportTimer = window.setTimeout(sendViewport, 120);
}).observe(stage);

// ======================================
// TOOLBAR | MARK: TOOLBAR
// ======================================

backBtn.addEventListener('click', () => post({ type: 'back' }));
forwardBtn.addEventListener('click', () => post({ type: 'forward' }));
reloadBtn.addEventListener('click', (e) => {
  if (isLoading) {
    post({ type: 'stop' });
  } else {
    post({ type: 'reload', hard: e.shiftKey });
  }
});
externalBtn.addEventListener('click', () => post({ type: 'openExternal' }));

urlInput.addEventListener('focus', () => urlInput.select());
urlInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') {
    post({ type: 'navigate', input: urlInput.value });
    urlInput.blur();
    canvas.focus();
  } else if (e.key === 'Escape') {
    urlInput.value = displayUrl(currentUrl);
    urlInput.blur();
    canvas.focus();
  }
});

// ======================================
// MOUSE INPUT | MARK: MOUSE
// ======================================

function modifiersOf(e: MouseEvent | KeyboardEvent | WheelEvent): number {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

function buttonOf(e: MouseEvent): 'left' | 'middle' | 'right' {
  return e.button === 1 ? 'middle' : e.button === 2 ? 'right' : 'left';
}

let lastPos = { x: 0, y: 0 };
let moveQueued = false;
let lastMove: MouseEvent | undefined;

canvas.addEventListener('mousedown', (e) => {
  canvas.focus();
  e.preventDefault();
  lastPos = { x: e.offsetX, y: e.offsetY };
  post({
    type: 'mouse',
    event: 'mousePressed',
    x: e.offsetX,
    y: e.offsetY,
    button: buttonOf(e),
    buttons: e.buttons,
    clickCount: Math.max(1, e.detail),
    modifiers: modifiersOf(e),
  });
});

canvas.addEventListener('mouseup', (e) => {
  e.preventDefault();
  lastPos = { x: e.offsetX, y: e.offsetY };
  post({
    type: 'mouse',
    event: 'mouseReleased',
    x: e.offsetX,
    y: e.offsetY,
    button: buttonOf(e),
    buttons: e.buttons,
    clickCount: Math.max(1, e.detail),
    modifiers: modifiersOf(e),
  });
});

// Release a drag that ends outside the canvas so buttons never get stuck.
window.addEventListener('mouseup', (e) => {
  if (e.target !== canvas) {
    post({
      type: 'mouse',
      event: 'mouseReleased',
      x: lastPos.x,
      y: lastPos.y,
      button: buttonOf(e),
      buttons: 0,
      clickCount: 1,
      modifiers: modifiersOf(e),
    });
  }
});

canvas.addEventListener('mousemove', (e) => {
  lastMove = e;
  if (moveQueued) {
    return;
  }
  moveQueued = true;
  requestAnimationFrame(() => {
    moveQueued = false;
    const move = lastMove;
    if (!move) {
      return;
    }
    lastPos = { x: move.offsetX, y: move.offsetY };
    post({
      type: 'mouse',
      event: 'mouseMoved',
      x: move.offsetX,
      y: move.offsetY,
      button: 'none',
      buttons: move.buttons,
      modifiers: modifiersOf(move),
    });
  });
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    post({
      type: 'mouse',
      event: 'mouseWheel',
      x: e.offsetX,
      y: e.offsetY,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      modifiers: modifiersOf(e),
    });
  },
  { passive: false }
);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ======================================
// KEYBOARD INPUT | MARK: KEYBOARD
// ======================================

canvas.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'l') {
    e.preventDefault();
    urlInput.focus();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && key === 'v') {
    e.preventDefault();
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) {
          post({ type: 'insertText', text });
        }
      })
      .catch(() => undefined);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && key === 'c') {
    post({ type: 'copySelection' });
    // Fall through: pages with custom copy handlers still get the key.
  }
  e.preventDefault();
  post({
    type: 'key',
    event: 'rawKeyDown',
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    autoRepeat: e.repeat,
    modifiers: modifiersOf(e),
  });
  const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey;
  if (printable) {
    post({ type: 'key', event: 'char', text: e.key, key: e.key, modifiers: modifiersOf(e) });
  } else if (e.key === 'Enter') {
    post({ type: 'key', event: 'char', text: '\r', key: e.key, modifiers: modifiersOf(e) });
  }
});

canvas.addEventListener('keyup', (e) => {
  e.preventDefault();
  post({
    type: 'key',
    event: 'keyUp',
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    modifiers: modifiersOf(e),
  });
});

// ======================================
// BOOT | MARK: BOOT
// ======================================

sendViewport();
post({ type: 'ready' });

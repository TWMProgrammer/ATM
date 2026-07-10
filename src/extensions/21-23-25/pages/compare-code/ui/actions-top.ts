// ======================================
// USER ACTIONS — TOP TOOLBAR | MARK: TOP
// ======================================

import { vscodeApi } from './vscode-api';
import type { I18n } from './i18n';

let isComparing = false;

function getI18n(): I18n | undefined {
  return (window as unknown as { i18n?: I18n }).i18n;
}

// ======================================
// COMPARE BUTTON STATE | MARK: STATE
// ======================================

/** Enable the compare button only when both editors have content. */
function checkButtonState(): void {
  const editor1 = document.getElementById('codeInput1') as HTMLTextAreaElement | null;
  const editor2 = document.getElementById('codeInput2') as HTMLTextAreaElement | null;
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement | null;

  if (!editor1 || !editor2 || !playBtn || isComparing) {
    return;
  }

  const shouldEnable =
    editor1.value.trim().length > 0 && editor2.value.trim().length > 0;

  if (shouldEnable) {
    enableCompareButton();
  } else {
    disableCompareButton();
  }
}

function enableCompareButton(): void {
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement | null;
  if (playBtn) {
    playBtn.disabled = false;
    playBtn.classList.remove('disabled');
    playBtn.title = 'Ctrl + Enter';
  }
}

function disableCompareButton(): void {
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement | null;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('disabled');
    playBtn.title = 'Both code areas must have content to compare';
  }
}

// ======================================
// PLAY BUTTON | MARK: PLAY
// ======================================

/**
 * The play/stop toggle icons are provided by the host as `data-icon-play` /
 * `data-icon-stop` attributes on the button. Reading them from the DOM avoids
 * the old race where the host `postMessage({setIcons})` fired before the
 * webview script had loaded, leaving the icons blank.
 */
export function setPlayBtnToEdit(): void {
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement | null;
  if (!playBtn) {
    return;
  }
  isComparing = true;

  const img = playBtn.querySelector('img');
  const span = playBtn.querySelector('span');
  const stopIcon = playBtn.dataset.iconStop;

  if (img && stopIcon) {
    img.src = stopIcon;
  }
  if (span) {
    span.textContent = getI18n()?.t('buttons.stop') ?? 'Stop';
  }

  playBtn.classList.add('stop');
  playBtn.classList.remove('disabled');
  playBtn.disabled = false;
  playBtn.title = 'Ctrl + Enter - Stop comparison';
}

export function setPlayBtnToCompare(): void {
  const playBtn = document.getElementById('playBtn') as HTMLButtonElement | null;
  if (!playBtn) {
    return;
  }
  isComparing = false;

  const img = playBtn.querySelector('img');
  const span = playBtn.querySelector('span');
  const playIcon = playBtn.dataset.iconPlay;

  if (img && playIcon) {
    img.src = playIcon;
  }
  if (span) {
    span.textContent = getI18n()?.t('buttons.compare') ?? 'Compare';
  }

  playBtn.classList.remove('stop');
  checkButtonState();
}

// ======================================
// TOOLBAR BUTTONS | MARK: TOOLBAR
// ======================================

function initializeContentMonitoring(): void {
  const editor1 = document.getElementById('codeInput1') as HTMLTextAreaElement | null;
  const editor2 = document.getElementById('codeInput2') as HTMLTextAreaElement | null;
  if (!editor1 || !editor2) {
    return;
  }

  [editor1, editor2].forEach((editor) => {
    editor.addEventListener('input', checkButtonState);
    editor.addEventListener('paste', () => requestAnimationFrame(checkButtonState));
    editor.addEventListener('keyup', checkButtonState);
  });

  checkButtonState();
}

function initializePanelButton(id: string, command: 'toggleLeftPanel' | 'toggleRightPanel'): void {
  const btn = document.getElementById(id);
  btn?.addEventListener('click', () => vscodeApi.postMessage({ command }));
}

// ======================================
// PANEL ACTIONS | MARK: PANELS
// ======================================

function editorIdFor(button: Element): string {
  return button.closest('.options-panel-left') !== null ? 'codeInput1' : 'codeInput2';
}

function initializeCopyButtons(): void {
  document.querySelectorAll<HTMLElement>('.copy-code').forEach((button) => {
    button.addEventListener('click', () => {
      const editor = document.getElementById(editorIdFor(button)) as HTMLTextAreaElement | null;
      if (editor && editor.value.trim()) {
        navigator.clipboard
          .writeText(editor.value)
          .then(() => {
            button.classList.add('copying');
            setTimeout(() => button.classList.remove('copying'), 2000);
          })
          .catch((err) => console.error('Failed to copy code:', err));
      }
    });
  });
}

function initializeClearCodeButtons(): void {
  document.querySelectorAll<HTMLElement>('.clear-code').forEach((button) => {
    button.addEventListener('click', () => {
      const editor = document.getElementById(editorIdFor(button)) as HTMLTextAreaElement | null;
      if (!editor) {
        return;
      }
      const hasContent = editor.value.trim() !== '';
      if (hasContent) {
        button.classList.add('clearing');
      }

      editor.value = '';
      editor.dispatchEvent(new Event('input'));

      const playBtn = document.getElementById('playBtn');
      if (playBtn?.classList.contains('stop')) {
        window.compareCode?.toggle();
      }

      checkButtonState();
      if (hasContent) {
        setTimeout(() => button.classList.remove('clearing'), 500);
      }
    });
  });
}

function initializeDownloadButtons(): void {
  document.querySelectorAll<HTMLElement>('.download-code').forEach((button) => {
    button.addEventListener('click', () => {
      const isLeftPanel = button.closest('.options-panel-left') !== null;
      const editor = document.getElementById(
        isLeftPanel ? 'codeInput1' : 'codeInput2'
      ) as HTMLTextAreaElement | null;
      if (!editor) {
        return;
      }
      const content = editor.value.trim();
      if (content) {
        vscodeApi.postMessage({
          command: 'downloadCode',
          content,
          panel: isLeftPanel ? 'left' : 'right',
          fileExtension: 'txt',
        });
        button.classList.add('downloading');
        setTimeout(() => button.classList.remove('downloading'), 500);
      } else {
        button.style.opacity = '0.5';
        setTimeout(() => (button.style.opacity = '1'), 300);
      }
    });
  });
}

// ======================================
// INITIALIZATION | MARK: INIT
// ======================================

export function initializeUserActions(): void {
  initializeCopyButtons();
  initializeDownloadButtons();
  initializeClearCodeButtons();
  initializePanelButton('btn-panel-left', 'toggleLeftPanel');
  initializePanelButton('btn-panel-right', 'toggleRightPanel');
  initializeContentMonitoring();
}

export { checkButtonState };

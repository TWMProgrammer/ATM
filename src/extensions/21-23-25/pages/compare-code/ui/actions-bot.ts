// ======================================
// USER ACTIONS — BOTTOM BAR | MARK: BOT
// ======================================

import { vscodeApi } from './vscode-api';
import { getEditorManager, isComparingMode } from './compare-code';
import type { I18n } from './i18n';

let syncScrollEnabled = false;
let isScrolling = false;
let onlyModifiedEnabled = false;
let isProMode = false;

function getI18n(): I18n | undefined {
  return (window as unknown as { i18n?: I18n }).i18n;
}

// ======================================
// DUAL SCROLL | MARK: SCROLL
// ======================================

export function initializeDualScroll(): void {
  const dualScrollBtn = document.getElementById('dual-scroll-btn');
  if (!dualScrollBtn) {
    return;
  }
  dualScrollBtn.addEventListener('click', toggleDualScroll);

  document
    .getElementById('dual-scroll-indicator-left')
    ?.addEventListener('click', toggleDualScroll);
  document
    .getElementById('dual-scroll-indicator-right')
    ?.addEventListener('click', toggleDualScroll);

  setupScrollListeners();
}

function toggleDualScroll(): void {
  syncScrollEnabled = !syncScrollEnabled;
  const indicatorLeft = document.getElementById('dual-scroll-indicator-left');
  const indicatorRight = document.getElementById('dual-scroll-indicator-right');
  const btn = document.getElementById('dual-scroll-btn');

  if (syncScrollEnabled) {
    if (indicatorLeft) {
      indicatorLeft.style.display = 'flex';
      indicatorLeft.textContent = '🔗';
    }
    if (indicatorRight) {
      indicatorRight.style.display = 'flex';
      indicatorRight.textContent = '🔗';
    }
    btn?.classList.add('active');
  } else {
    if (indicatorLeft) {
      indicatorLeft.style.display = 'none';
    }
    if (indicatorRight) {
      indicatorRight.style.display = 'none';
    }
    btn?.classList.remove('active');
  }
}

function syncScroll(source: HTMLElement, target: HTMLElement): void {
  if (!syncScrollEnabled || isScrolling) {
    return;
  }
  isScrolling = true;

  const sourceMaxScroll = source.scrollHeight - source.clientHeight;
  const targetMaxScroll = target.scrollHeight - target.clientHeight;

  if (sourceMaxScroll <= 0 || targetMaxScroll <= 0) {
    isScrolling = false;
    return;
  }

  const ratio = source.scrollTop / sourceMaxScroll;
  target.scrollTop = Math.max(0, Math.min(ratio * targetMaxScroll, targetMaxScroll));

  setTimeout(() => {
    isScrolling = false;
  }, 16);
}

function setupScrollListeners(): void {
  const codeInput1 = document.getElementById('codeInput1') as HTMLTextAreaElement | null;
  const codeInput2 = document.getElementById('codeInput2') as HTMLTextAreaElement | null;
  const codeDisplay1 = document.getElementById('codeDisplay1');
  const codeDisplay2 = document.getElementById('codeDisplay2');

  if (codeInput1 && codeInput2) {
    codeInput1.addEventListener('scroll', () => syncScroll(codeInput1, codeInput2));
    codeInput2.addEventListener('scroll', () => syncScroll(codeInput2, codeInput1));
  }
  if (codeDisplay1 && codeDisplay2) {
    codeDisplay1.addEventListener('scroll', () => syncScroll(codeDisplay1, codeDisplay2));
    codeDisplay2.addEventListener('scroll', () => syncScroll(codeDisplay2, codeDisplay1));
  }
}

// ======================================
// ONLY MODIFIED | MARK: FILTER
// ======================================

function toggleOnlyModified(): void {
  if (!isComparingMode()) {
    return;
  }

  const editorManager = getEditorManager();
  const { lines1 } = editorManager.getCurrentLines();
  const hasModified = lines1.some((line) => line.type !== 'identical');
  const btn = document.querySelector('.only-code.bbtn');

  if (onlyModifiedEnabled) {
    onlyModifiedEnabled = false;
    btn?.classList.remove('active');
    editorManager.renderFiltered(() => true);
  } else {
    if (!hasModified) {
      return;
    }
    onlyModifiedEnabled = true;
    btn?.classList.add('active');
    editorManager.renderFiltered((line) => line.type !== 'identical');
  }
}

export function resetOnlyModified(): void {
  if (onlyModifiedEnabled) {
    onlyModifiedEnabled = false;
    document.querySelector('.only-code.bbtn')?.classList.remove('active');
  }
}

export function initializeOnlyCode(): void {
  document.querySelector('.only-code.bbtn')?.addEventListener('click', toggleOnlyModified);
}

// ======================================
// SWITCH MODE (NORMAL / PRO) | MARK: SWITCH
// ======================================

/**
 * The on/off toggle icons are provided by the host as `data-icon-on` /
 * `data-icon-off` on the switch button, mirroring the play/stop approach.
 */
export function toggleSwitchMode(): void {
  isProMode = !isProMode;

  const btn = document.querySelector('.switch-on-off') as HTMLElement | null;
  const icon = btn?.querySelector('.icon') as HTMLImageElement | null;

  if (btn && icon) {
    const onUri = btn.dataset.iconOn;
    const offUri = btn.dataset.iconOff;
    icon.style.opacity = '0';
    setTimeout(() => {
      const newSrc = isProMode ? offUri : onUri;
      if (newSrc) {
        icon.src = newSrc;
      }
      icon.style.opacity = '1';
    }, 150);
  }

  const normalStats = document.getElementById('normal-stats');
  const proStats = document.getElementById('pro-stats');
  if (!normalStats || !proStats) {
    return;
  }

  if (isProMode) {
    normalStats.style.opacity = '0';
    setTimeout(() => {
      normalStats.style.visibility = 'hidden';
      proStats.style.opacity = '1';
      proStats.style.visibility = 'visible';
    }, 250);
  } else {
    proStats.style.opacity = '0';
    setTimeout(() => {
      proStats.style.visibility = 'hidden';
      normalStats.style.opacity = '1';
      normalStats.style.visibility = 'visible';
    }, 250);
  }
}

// ======================================
// LANGUAGE SELECTOR | MARK: LANGUAGE
// ======================================

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function initializeLanguageMenu(): void {
  const languageBtn = document.querySelector('.language') as HTMLElement | null;
  if (!languageBtn) {
    return;
  }

  const dropdown = createLanguageDropdown();
  languageBtn.appendChild(dropdown);

  languageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('show')) {
      closeDropdown(dropdown);
    } else {
      updateSelectedLanguage(dropdown);
      dropdown.classList.remove('closing');
      dropdown.classList.add('show');
    }
  });

  document.addEventListener('click', () => closeDropdown(dropdown));

  setTimeout(() => updateSelectedLanguage(dropdown), 50);
  window.addEventListener('languageChanged', () => updateSelectedLanguage(dropdown));
}

function closeDropdown(dropdown: HTMLElement): void {
  if (dropdown.classList.contains('show')) {
    dropdown.classList.add('closing');
    dropdown.classList.remove('show');
    setTimeout(() => dropdown.classList.remove('closing'), 250);
  }
}

function createLanguageDropdown(): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'language-dropdown';

  LANGUAGES.forEach((lang) => {
    const option = document.createElement('div');
    option.className = 'language-option';
    // Flag + name are static, trusted strings (no user input).
    option.textContent = `${lang.flag} ${lang.name}`;
    option.dataset.lang = lang.code;

    option.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown
        .querySelectorAll('.language-option')
        .forEach((opt) => opt.classList.remove('selected'));
      option.classList.add('selected');
      changeLanguage(lang.code);
      closeDropdown(dropdown);
    });

    dropdown.appendChild(option);
  });

  return dropdown;
}

function updateSelectedLanguage(dropdown: HTMLElement): void {
  const currentLang = getI18n()?.getCurrentLanguage() ?? 'en';
  dropdown.querySelectorAll<HTMLElement>('.language-option').forEach((option) => {
    option.classList.toggle('selected', option.dataset.lang === currentLang);
  });
}

function changeLanguage(langCode: string): void {
  const i18n = getI18n();
  if (i18n) {
    i18n.setLanguage(langCode);
    vscodeApi.postMessage({ command: 'changeLanguage', language: langCode });
  }
}

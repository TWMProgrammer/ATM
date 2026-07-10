// ======================================
// I18N SERVICE (WEBVIEW) | MARK: I18N
// ======================================

/**
 * Lightweight translation layer for the compare-code webview.
 *
 * Unlike the original extension, translations are **bundled** into the webview
 * script at build time (esbuild embeds these JSON imports). This removes the
 * previous runtime `fs` read plus inline `<script>` injection, which is
 * incompatible with a strict Content-Security-Policy.
 */

import en from '../l10n/en.json';
import es from '../l10n/es.json';
import pt from '../l10n/pt.json';
import zh from '../l10n/zh.json';

type TranslationTree = { [key: string]: string | TranslationTree };

const translations: Record<string, TranslationTree> = { en, es, pt, zh };
const SUPPORTED = Object.keys(translations);
const STORAGE_KEY = 'compareCode.language';

let currentLanguage = 'en';

export interface I18n {
  t(keyPath: string, ...args: string[]): string;
  setLanguage(language: string): void;
  getCurrentLanguage(): string;
}

/**
 * Normalise a full locale (`pt-br`, `zh-CN`, ...) to one of the supported codes.
 */
function mapLanguageCode(langCode: string): string {
  const code = langCode.toLowerCase().split('-')[0];
  return SUPPORTED.includes(code) ? code : 'en';
}

/**
 * Resolve the initial language: saved preference → host-provided VS Code
 * locale (`data-locale` on <html>) → browser language → English.
 */
function detectInitialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) {
      return saved;
    }
  } catch {
    /* localStorage may be unavailable */
  }

  const hostLocale = document.documentElement.dataset.locale;
  if (hostLocale) {
    return mapLanguageCode(hostLocale);
  }

  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  return mapLanguageCode(browserLang);
}

/**
 * Look up a dotted key path and interpolate `{0}`, `{1}`, ... placeholders.
 */
function t(keyPath: string, ...args: string[]): string {
  const keys = keyPath.split('.');
  let value: string | TranslationTree | undefined = translations[currentLanguage];

  for (const key of keys) {
    if (value === undefined || typeof value === 'string') {
      value = undefined;
      break;
    }
    value = value[key];
  }

  if (typeof value !== 'string') {
    return keyPath;
  }

  return value.replace(/\{(\d+)\}/g, (match, index) => {
    const argIndex = parseInt(index, 10);
    return args[argIndex] !== undefined ? args[argIndex] : match;
  });
}

/**
 * Apply the active language to every element tagged with `data-i18n*`.
 */
function applyTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const translated = t(key);
    const attr = element.getAttribute('data-i18n-attr');
    if (attr) {
      element.setAttribute(attr, translated);
    } else {
      element.textContent = translated;
    }
  });

  document
    .querySelectorAll<HTMLElement>('[data-i18n-placeholder]')
    .forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) {
        element.setAttribute('placeholder', t(key));
      }
    });

  window.dispatchEvent(
    new CustomEvent('languageChanged', { detail: { language: currentLanguage } })
  );
}

function setLanguage(language: string): void {
  if (!translations[language]) {
    return;
  }
  currentLanguage = language;
  applyTranslations();
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* persistence is best-effort */
  }
}

/**
 * Initialise the service and paint the initial UI. Safe to call once the DOM is
 * ready (the bundle is deferred, so it always is).
 */
export function initI18n(): I18n {
  currentLanguage = detectInitialLanguage();
  applyTranslations();

  const api: I18n = { t, setLanguage, getCurrentLanguage: () => currentLanguage };
  // Kept as a global for the toolbar modules that read `window.i18n`.
  (window as unknown as { i18n: I18n }).i18n = api;
  return api;
}

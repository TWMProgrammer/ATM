import type { I18n } from './i18n';

/**
 * Globals shared across the bundled webview modules. The entry point exposes a
 * small `window.compareCode` facade so toolbar handlers can trigger core
 * actions without importing the entry (which would create a cycle).
 */
declare global {
  interface Window {
    i18n?: I18n;
    compareCode?: {
      toggle(): void;
      clearAll(): void;
      toggleSwitchMode(): void;
    };
  }
}

export {};

// ======================================
// COMPARE CODE — WEBVIEW ENTRY | MARK: MAIN
// ======================================

import { ComparisonEngine } from '../core/comparison-engine';
import type { ComparisonResult } from '../core/types';
import { EditorManager } from './editor-manager';
import { UserInformationManager } from './user-info';
import { showToast } from './toast';
import { initI18n } from './i18n';
import { initializeIconUpdater } from './icon-updater';
import { initializeTooltips } from './tooltips';
import {
  initializeUserActions,
  setPlayBtnToEdit,
  setPlayBtnToCompare,
} from './actions-top';
import {
  initializeDualScroll,
  initializeOnlyCode,
  resetOnlyModified,
  initializeLanguageMenu,
  toggleSwitchMode,
} from './actions-bot';
import {
  showPerfectMatchEffect,
  hidePerfectMatchEffect,
  MATCH_EFFECT_CONFIG,
} from './match-effect';

let isComparing = false;
let editorManager: EditorManager | undefined;

// ======================================
// CORE ACTIONS | MARK: CORE
// ======================================

/** Toggle between edit and compare modes. */
export function toggle(): void {
  if (isComparing) {
    reset();
  } else {
    compare();
  }
}

/** Start a comparison of the two panels. */
export function compare(): void {
  if (!editorManager) {
    console.error('Editor manager not initialized');
    return;
  }

  try {
    const text1 = editorManager.getContent('1');
    const text2 = editorManager.getContent('2');

    if (!text1.trim() || !text2.trim()) {
      const message =
        window.i18n?.t('messages.pleaseEnterCode') ??
        'Both code areas must have content to compare';
      showToast(message, 'warning');
      return;
    }

    const comparison: ComparisonResult = ComparisonEngine.compare(text1, text2);

    editorManager.setCompareMode(comparison.lines1, comparison.lines2);
    isComparing = true;
    setPlayBtnToEdit();
    UserInformationManager.updateStatsDisplay(comparison.stats);
    UserInformationManager.updateNormalStats(comparison.stats, comparison.similarity);

    const isPerfectMatch =
      comparison.similarity === 100 &&
      comparison.stats.added === 0 &&
      comparison.stats.removed === 0 &&
      comparison.stats.modified === 0;

    if (isPerfectMatch) {
      showPerfectMatchEffect();
      setTimeout(hidePerfectMatchEffect, MATCH_EFFECT_CONFIG.HIDE_DELAY);
    }
  } catch (error) {
    console.error('Comparison failed:', error);
    setPlayBtnToCompare();
    showToast('An error occurred during comparison. Please try again.', 'error');
  }
}

/** Return to edit mode. */
export function reset(): void {
  if (!editorManager) {
    console.error('Editor manager not initialized');
    return;
  }
  try {
    editorManager.setEditMode();
    isComparing = false;
    setPlayBtnToCompare();
    UserInformationManager.clearStatsDisplay();
    resetOnlyModified();
  } catch (error) {
    console.error('Reset failed:', error);
  }
}

/** Clear both editors and return to edit mode. */
export function clearAll(): void {
  if (!editorManager) {
    return;
  }
  if (isComparing) {
    reset();
  }
  editorManager.clearAll();
  // Refresh line numbers and the compare-button state via existing listeners.
  ['codeInput1', 'codeInput2'].forEach((id) => {
    document.getElementById(id)?.dispatchEvent(new Event('input'));
  });
}

// ======================================
// PUBLIC ACCESSORS | MARK: API
// ======================================

export function getEditorManager(): EditorManager {
  if (!editorManager) {
    throw new Error('Editor manager not initialized');
  }
  return editorManager;
}

export function isComparingMode(): boolean {
  return isComparing;
}

// ======================================
// INITIALIZATION | MARK: INIT
// ======================================

function initializeCompareCode(): void {
  editorManager = new EditorManager();

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    } else if (e.shiftKey && e.altKey && e.key === 'Backspace') {
      e.preventDefault();
      clearAll();
    }
  });
}

/** Wire the buttons that previously relied on CSP-illegal inline onclick. */
function bindToolbarTriggers(): void {
  document.getElementById('playBtn')?.addEventListener('click', toggle);
  document.querySelector('.clear')?.addEventListener('click', clearAll);
  document.querySelector('.switch-on-off')?.addEventListener('click', toggleSwitchMode);
}

function bootstrap(): void {
  try {
    initI18n();
    initializeIconUpdater();
    initializeTooltips();
    initializeUserActions();
    initializeDualScroll();
    initializeOnlyCode();
    initializeLanguageMenu();
    initializeCompareCode();
    bindToolbarTriggers();

    // Facade used by toolbar modules to trigger core actions without a cycle.
    window.compareCode = { toggle, clearAll, toggleSwitchMode };
  } catch (error) {
    console.error('Failed to initialize Compare Code:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

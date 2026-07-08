import { ComparisonStats } from '../core/types';
import { showToast } from './toast';
import type { I18n } from './i18n';

// ======================================
// USER INFORMATION MANAGER | MARK: MANAGER
// ======================================

function getI18n(): I18n | undefined {
  return (window as unknown as { i18n?: I18n }).i18n;
}

/**
 * Manages the display of comparison statistics and user information.
 */
export class UserInformationManager {
  // ======================================
  // STATISTICS DISPLAY | MARK: STATS
  // ======================================

  /** Update the pro statistics display in the toolbar. */
  public static updateStatsDisplay(stats: ComparisonStats): void {
    this.renderStat('added-count', stats.added, 'stats.linesAdded', 'lines added');
    this.renderStat('removed-count', stats.removed, 'stats.linesRemoved', 'lines removed');
    this.renderStat('modified-count', stats.modified, 'stats.linesModified', 'lines modified');
  }

  /** Clear all statistics display (reset to zero). */
  public static clearStatsDisplay(): void {
    this.renderStat('added-count', 0, 'stats.linesAdded', 'lines added');
    this.renderStat('removed-count', 0, 'stats.linesRemoved', 'lines removed');
    this.renderStat('modified-count', 0, 'stats.linesModified', 'lines modified');
  }

  private static renderStat(
    elementId: string,
    count: number,
    key: string,
    fallback: string
  ): void {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }
    const label = getI18n()?.t(key) ?? fallback;
    element.innerHTML = `${count} <span data-i18n="${key}">${label}</span>`;
  }

  /** Update the normal stats container with changes count and similarity score. */
  public static updateNormalStats(
    stats: ComparisonStats,
    similarity: number
  ): void {
    const warningBox = document.querySelector('.warning-box span');
    const matchScore = document.querySelector('.match-score');
    const i18n = getI18n();

    if (warningBox) {
      const totalChanges = stats.added + stats.removed + stats.modified;
      const changesText = i18n?.t('stats.changes') ?? 'Changes';
      warningBox.innerHTML = `${totalChanges} : <span data-i18n="stats.changes">${changesText}</span>`;
    }

    if (matchScore) {
      const similarText = i18n?.t('stats.similar') ?? 'Similar';
      matchScore.innerHTML = `${similarity}% : <span data-i18n="stats.similar">${similarText}</span>`;
    }
  }

  // ======================================
  // NOTIFICATIONS | MARK: NOTIFICATIONS
  // ======================================

  /** Display a user notification (non-blocking toast). */
  public static showNotification(
    message: string,
    type: 'info' | 'warning' | 'error' = 'info'
  ): void {
    if (type === 'info') {
      console.log(`Info: ${message}`);
      return;
    }
    showToast(message, type);
  }

  // ======================================
  // UI CONTROLS | MARK: CONTROLS
  // ======================================

  /** Validate user input and surface a message when both fields are empty. */
  public static validateInput(text1: string, text2: string): boolean {
    if (!text1.trim() && !text2.trim()) {
      const message =
        getI18n()?.t('messages.pleaseEnterCode') ??
        'Please enter code in at least one field';
      this.showNotification(message, 'warning');
      return false;
    }
    return true;
  }
}

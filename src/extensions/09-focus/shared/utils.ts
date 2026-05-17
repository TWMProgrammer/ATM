/**
 * ATM Common UI Utilities
 * Browser-friendly helper functions.
 */

/**
 * Escapes HTML characters to prevent XSS attacks.
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Formats seconds into a M:SS string.
 */
export function formatDuration(sec: number): string {
    if (!sec || sec < 0) {
        return '0:00';
    }
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Truncates text with dots if it exceeds a certain length.
 */
export function truncateWithDots(text: string, maxLength: number): string {
    const value = (text || '').trim();
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * Selector shorthand for single element.
 */
export function $(selector: string): HTMLElement | null {
    return document.querySelector(selector);
}

/**
 * Selector shorthand for multiple elements.
 */
export function $$(selector: string): NodeListOf<HTMLElement> {
    return document.querySelectorAll(selector);
}

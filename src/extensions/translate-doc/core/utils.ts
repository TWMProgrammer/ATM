// =========================================================
// 🛠️ SHARED HTML UTILITIES
// =========================================================

/**
 * Escape HTML special characters to prevent XSS injection.
 * Use this when inserting dynamic text into HTML body content.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape characters that are unsafe inside HTML attribute values.
 * Use this when inserting dynamic values into quoted HTML attributes.
 */
export function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ======================================
// TOAST NOTIFICATIONS | MARK: TOAST
// ======================================

/**
 * Minimal, non-blocking notifications for the webview.
 *
 * VS Code webviews run in a sandbox where `alert()` / `confirm()` are no-ops,
 * so the original code's alerts silently failed. This renders a transient,
 * self-contained toast instead (styled in compare-code.css).
 */

export type ToastType = 'info' | 'warning' | 'error';

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration = 3000
): void {
  let container = document.getElementById('cc-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'cc-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `cc-toast cc-toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);

  // Force a frame so the entrance transition runs.
  requestAnimationFrame(() => toast.classList.add('cc-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('cc-toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

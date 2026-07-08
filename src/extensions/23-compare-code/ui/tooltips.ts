// ======================================
// TOOLTIP MANAGER | MARK: TOOLTIP
// ======================================

/**
 * Hides a CSS tooltip once its element is clicked and re-enables it after the
 * pointer leaves, so the tooltip doesn't linger over an already-actioned button.
 */

function bindTooltip(element: Element): void {
  const el = element as HTMLElement;
  if (el.dataset.tooltipInitialized) {
    return;
  }
  el.addEventListener('click', () => el.classList.add('tooltip-disabled'));
  el.addEventListener('mouseleave', () => el.classList.remove('tooltip-disabled'));
  el.dataset.tooltipInitialized = 'true';
}

export function initializeTooltips(): void {
  document.querySelectorAll('[data-tooltip]').forEach(bindTooltip);

  // Re-bind tooltips added dynamically (e.g. the language dropdown).
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        const element = node as HTMLElement;
        if (element.hasAttribute('data-tooltip')) {
          bindTooltip(element);
        }
        element.querySelectorAll('[data-tooltip]').forEach(bindTooltip);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

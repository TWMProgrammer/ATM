// ======================================
// DYNAMIC ICON UPDATER | MARK: ICONS
// ======================================

/**
 * Swaps the webview's SVG icons when the VS Code color theme changes. The host
 * posts a fresh (theme-appropriate) icon set; here we update both the visible
 * `<img>` sources and the `data-icon-*` attributes that drive the play/stop and
 * normal/pro toggles.
 */

export interface IconSet {
  warning: string;
  play: string;
  stop: string;
  panelLeft: string;
  panelRight: string;
  dualScroll: string;
  earthCode: string;
  language: string;
  onlyCode: string;
  switchOff: string;
  switchOn: string;
  clear: string;
  copy: string;
  download: string;
}

function setSrc(selector: string, src: string): void {
  document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
    img.src = src;
  });
}

function updateAllIcons(icons: IconSet): void {
  setSrc('img.warning-icon', icons.warning);
  setSrc('.btn-panel-left img', icons.panelLeft);
  setSrc('.btn-panel-right img', icons.panelRight);
  setSrc('.dual-scroll img.icon', icons.dualScroll);
  setSrc('.language img.icon', icons.language);
  setSrc('.only-code img.icon', icons.onlyCode);
  setSrc('.sponsor img.icon', icons.earthCode);
  setSrc('.options-panel-left .clear-code img', icons.clear);
  setSrc('.options-panel-right .clear-code img', icons.clear);
  setSrc('.options-panel-left .copy-code img', icons.copy);
  setSrc('.options-panel-right .copy-code img', icons.copy);
  setSrc('.options-panel-left .download-code img', icons.download);
  setSrc('.options-panel-right .download-code img', icons.download);

  // Play / stop: keep the current logical state, only swap the theme variant.
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.dataset.iconPlay = icons.play;
    playBtn.dataset.iconStop = icons.stop;
    const img = playBtn.querySelector('img');
    if (img) {
      img.src = playBtn.classList.contains('stop') ? icons.stop : icons.play;
    }
  }

  // Normal / pro switch toggle.
  const switchBtn = document.querySelector('.switch-on-off') as HTMLElement | null;
  if (switchBtn) {
    switchBtn.dataset.iconOn = icons.switchOn;
    switchBtn.dataset.iconOff = icons.switchOff;
    const img = switchBtn.querySelector('img');
    if (img && !switchBtn.dataset.pro) {
      img.src = icons.switchOn;
    }
  }
}

export function initializeIconUpdater(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message?.command === 'updateIcons' && message.icons) {
      updateAllIcons(message.icons as IconSet);
    }
  });
}

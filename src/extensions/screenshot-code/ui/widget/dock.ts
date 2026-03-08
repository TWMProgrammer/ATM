import './dock.css';

const GRADIENT_PRESETS = [
  { name: 'Indigo Night', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Sunset Blaze', value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { name: 'Emerald Glow', value: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)' },
  { name: 'Rose Gold', value: 'linear-gradient(135deg, #f43f5e 0%, #d946ef 100%)' },
  { name: 'Amber Flame', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { name: 'Deep Space', value: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d2b55 100%)' },
  { name: 'Aurora', value: 'linear-gradient(135deg, #00f5a0 0%, #00d9f5 100%)' },
  { name: 'Cyber Punk', value: 'linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)' },
];

export interface DockConfig {
  containerId: string;
  snippetContainerId: string;
  windowNodeId: string;
  navbarNodeId: string;
  snippetNodeId: string;
  
  getCurrentLineNumbersVisible: () => boolean;
  onToggleLineNumbers: (show: boolean) => void;
  onSave: (btn: HTMLElement) => Promise<void>;
  onCopy: (btn: HTMLElement) => Promise<void>;
}

export class DockWidget {
  private config: DockConfig;
  private currentPadding = 48;
  private showLineNumbers = true;
  private showWindowChrome = true;
  private showShadow = true;
  private paletteOpen = false;

  constructor(config: DockConfig) {
    this.config = config;
    this.showLineNumbers = config.getCurrentLineNumbersVisible();
    this.render();
    this.attachEvents();
  }

  private $(sel: string, ctx: Document | HTMLElement = document) {
    return ctx.querySelector<HTMLElement>(sel);
  }

  private $$(sel: string, ctx: Document | HTMLElement = document) {
    return Array.from(ctx.querySelectorAll<HTMLElement>(sel));
  }

  private render() {
    const container = this.$(`#${this.config.containerId}`);
    if (!container) {
      return;
    }

    const iconSave = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const iconCopy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const iconNoBg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`;
    const iconShadow = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h14v14H3z"/><path d="M7 21h14V7"/></svg>`;
    const iconChrome = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><circle cx="7.5" cy="6" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="16.5" cy="6" r="1"/></svg>`;
    const iconLines = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><line x1="4" y1="6" x2="4.01" y2="6"/><line x1="4" y1="12" x2="4.01" y2="12"/><line x1="4" y1="18" x2="4.01" y2="18"/></svg>`;
    const iconPalette = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2"/><circle cx="17.5" cy="10.5" r="2"/><circle cx="8.5" cy="7.5" r="2"/><circle cx="6.5" cy="12" r="2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;

    // Build color swatches for the fan popup
    const swatchesHtml = GRADIENT_PRESETS.map((preset, i) => 
      `<div class="fan-swatch${i === 0 ? ' active' : ''}" style="background: ${preset.value}" data-value="${preset.value}" data-index="${i}">
         <span class="tooltip">${preset.name}</span>
       </div>`
    ).join('');

    container.innerHTML = `
      <div id="dock" class="dock-widget">
        <!-- Actions -->
        <button id="btn-save" class="dock-item primary">
          ${iconSave}
          <span class="tooltip">Save Image</span>
        </button>
        <button id="btn-copy" class="dock-item">
          ${iconCopy}
          <span class="tooltip">Copy Image</span>
        </button>

        <div class="dock-separator"></div>

        <!-- Toggles -->
        <button id="btn-toggle-bg" class="dock-item toggle-btn">
          ${iconNoBg}
          <span class="tooltip">Transparent BG</span>
        </button>
        <button id="btn-toggle-lines" class="dock-item toggle-btn active">
          ${iconLines}
          <span class="tooltip">Line Numbers</span>
        </button>
        <button id="btn-toggle-shadow" class="dock-item toggle-btn active">
          ${iconShadow}
          <span class="tooltip">Shadow</span>
        </button>
        <button id="btn-toggle-chrome" class="dock-item toggle-btn active">
          ${iconChrome}
          <span class="tooltip">Window Bar</span>
        </button>

        <div class="dock-separator"></div>

        <!-- Padding Slider -->
        <div class="dock-slider">
          <input type="range" id="padding-slider" min="0" max="96" value="${this.currentPadding}" />
          <span class="tooltip">Padding</span>
        </div>

        <div class="dock-separator"></div>

        <!-- Palette (fan popup) -->
        <div class="palette-wrapper">
          <button id="btn-palette" class="dock-item palette-trigger">
            <div class="palette-indicator" id="palette-indicator"></div>
            ${iconPalette}
            <span class="tooltip">Colors</span>
          </button>
          <div id="palette-fan" class="palette-fan">
            ${swatchesHtml}
            <div class="fan-swatch color-picker-swatch" title="Custom color">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              <input type="color" id="bg-color-picker" value="#667eea" />
              <span class="tooltip">Custom Color</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Set initial palette indicator
    const indicator = this.$('#palette-indicator');
    if (indicator) {
      indicator.style.background = GRADIENT_PRESETS[0].value;
    }
  }

  private attachEvents() {
    const snippetContainer = this.$(`#${this.config.snippetContainerId}`);
    const windowNode = this.$(`#${this.config.windowNodeId}`);
    const navbarNode = this.$(`#${this.config.navbarNodeId}`);

    /* ─── Palette toggle ────────────────── */
    this.$('#btn-palette')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePalette();
    });

    // Close palette on outside click
    document.addEventListener('click', (e) => {
      const fan = this.$('#palette-fan');
      const wrapper = this.$('.palette-wrapper');
      if (this.paletteOpen && wrapper && !wrapper.contains(e.target as Node)) {
        this.closePalette();
      }
      // Also close if clicking fan swatches (after selection)
      if (fan && fan.contains(e.target as Node)) {
        const swatch = (e.target as HTMLElement).closest('.fan-swatch');
        if (swatch && !swatch.classList.contains('color-picker-swatch')) {
          setTimeout(() => this.closePalette(), 200);
        }
      }
    });

    /* ─── Gradient presets (fan) ────────── */
    this.$$('.fan-swatch:not(.color-picker-swatch)').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (snippetContainer) {
          const val = swatch.getAttribute('data-value') || '';
          snippetContainer.style.background = val;
          snippetContainer.classList.remove('no-bg');

          // Update indicator
          const indicator = this.$('#palette-indicator');
          if (indicator) {
            indicator.style.background = val;
          }
        }
        this.$$('.fan-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        setTimeout(() => this.closePalette(), 200);
      });
    });

    /* ─── Custom colour picker ────────────── */
    const colorPicker = this.$('#bg-color-picker') as HTMLInputElement;
    if (colorPicker && snippetContainer) {
      colorPicker.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      colorPicker.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        snippetContainer.style.background = color;
        snippetContainer.classList.remove('no-bg');
        this.$$('.fan-swatch').forEach(s => s.classList.remove('active'));
        const parent = colorPicker.parentElement;
        if (parent) {
          parent.classList.add('active');
        }
        // Update indicator
        const indicator = this.$('#palette-indicator');
        if (indicator) {
          indicator.style.background = color;
        }
      });
    }

    /* ─── Transparent background toggle ───── */
    this.$('#btn-toggle-bg')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      if (snippetContainer) {
        snippetContainer.classList.toggle('no-bg');
        btn.classList.toggle('active', snippetContainer.classList.contains('no-bg'));
      }
    });

    /* ─── Shadow toggle ──────────────────── */
    this.$('#btn-toggle-shadow')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      this.showShadow = !this.showShadow;
      windowNode?.classList.toggle('no-shadow', !this.showShadow);
      btn.classList.toggle('active', this.showShadow);
    });

    /* ─── Window chrome toggle ────────────── */
    this.$('#btn-toggle-chrome')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      this.showWindowChrome = !this.showWindowChrome;
      navbarNode?.classList.toggle('hidden', !this.showWindowChrome);
      btn.classList.toggle('active', this.showWindowChrome);
    });

    /* ─── Line numbers toggle ────────────── */
    this.$('#btn-toggle-lines')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      this.showLineNumbers = !this.showLineNumbers;
      btn.classList.toggle('active', this.showLineNumbers);
      this.config.onToggleLineNumbers(this.showLineNumbers);
    });

    /* ─── Padding slider ─────────────────── */
    const paddingSlider = this.$('#padding-slider') as HTMLInputElement | null;
    if (paddingSlider && snippetContainer) {
      paddingSlider.addEventListener('input', () => {
        this.currentPadding = parseInt(paddingSlider.value, 10);
        snippetContainer.style.padding = `${this.currentPadding}px`;
      });
    }

    /* ─── Save / Copy Actions ──────────────── */
    this.$('#btn-save')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLElement;
      await this.config.onSave(btn);
    });

    this.$('#btn-copy')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLElement;
      await this.config.onCopy(btn);
    });
  }

  private togglePalette() {
    if (this.paletteOpen) {
      this.closePalette();
    } else {
      this.openPalette();
    }
  }

  private openPalette() {
    const fan = this.$('#palette-fan');
    const trigger = this.$('#btn-palette');
    if (!fan || !trigger) { return; }

    this.paletteOpen = true;
    fan.classList.add('open');
    trigger.classList.add('active');

    // Stagger animation for each swatch
    const swatches = this.$$('.fan-swatch', fan);
    swatches.forEach((swatch, i) => {
      swatch.style.transitionDelay = `${i * 30}ms`;
    });
  }

  private closePalette() {
    const fan = this.$('#palette-fan');
    const trigger = this.$('#btn-palette');
    if (!fan || !trigger) { return; }

    this.paletteOpen = false;

    // Reverse stagger
    const swatches = this.$$('.fan-swatch', fan);
    const total = swatches.length;
    swatches.forEach((swatch, i) => {
      swatch.style.transitionDelay = `${(total - 1 - i) * 20}ms`;
    });

    fan.classList.remove('open');
    trigger.classList.remove('active');
  }
}

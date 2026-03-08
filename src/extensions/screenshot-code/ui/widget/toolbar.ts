import './toolbar.css';

const GRADIENT_PRESETS = [
  { name: 'Indigo Night', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Ocean Breeze', value: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' },
  { name: 'Sunset Blaze', value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { name: 'Emerald Glow', value: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)' },
  { name: 'Rose Gold', value: 'linear-gradient(135deg, #f43f5e 0%, #d946ef 100%)' },
  { name: 'Midnight Blue', value: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' },
  { name: 'Amber Flame', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { name: 'Slate Mono', value: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' },
];

export interface ToolbarConfig {
  containerId: string; // the DOM id where toolbar is injected
  snippetContainerId: string; // The container id for background/padding (e.g. snippet-container)
  windowNodeId: string; // The window for shadow toggle
  navbarNodeId: string; // The navbar for chrome toggle
  snippetNodeId: string; // The snippet content for line numbers
  
  getCurrentLineNumbersVisible: () => boolean;
  onToggleLineNumbers: (show: boolean) => void;
  onSave: () => Promise<void>;
  onCopy: (btn: HTMLElement) => Promise<void>;
}

export class ToolbarWidget {
  private config: ToolbarConfig;
  private currentPadding = 48;
  private showLineNumbers = true;
  private showWindowChrome = true;
  private showShadow = true;

  constructor(config: ToolbarConfig) {
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

    const downloadIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const copyIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

    const presetsHtml = GRADIENT_PRESETS.map((preset, i) => 
      `<div class="gradient-swatch${i === 0 ? ' active' : ''}" style="background: ${preset.value}" title="${preset.name}" data-value="${preset.value}"></div>`
    ).join('');

    container.innerHTML = `
      <div id="toolbar" class="toolbar-widget">
        <button id="btn-save" title="Save as PNG" class="action-btn primary">
            ${downloadIconHtml} Save
        </button>
        <button id="btn-copy" title="Copy to clipboard" class="action-btn">
            ${copyIconHtml} Copy
        </button>

        <div class="divider"></div>

        <!-- Gradient presets -->
        <div class="control-label">
            BG
            <div id="gradient-presets" class="gradient-presets">
              ${presetsHtml}
            </div>
            <input type="color" id="bg-color-picker" value="#667eea" title="Custom colour" />
        </div>

        <div class="divider"></div>

        <!-- Padding -->
        <div class="slider-group">
            <span class="control-label">PAD</span>
            <input type="range" id="padding-slider" min="0" max="96" value="${this.currentPadding}" />
        </div>

        <div class="divider"></div>

        <!-- Toggles -->
        <button id="btn-toggle-bg" class="toggle-btn" title="Transparent background">No BG</button>
        <button id="btn-toggle-shadow" class="toggle-btn active" title="Toggle shadow">Shadow</button>
        <button id="btn-toggle-chrome" class="toggle-btn active" title="Toggle window bar">Chrome</button>
        <button id="btn-toggle-lines" class="toggle-btn active" title="Toggle line numbers">Lines</button>
      </div>
    `;
  }

  private attachEvents() {
    const snippetContainer = this.$(`#${this.config.snippetContainerId}`);
    const windowNode = this.$(`#${this.config.windowNodeId}`);
    const navbarNode = this.$(`#${this.config.navbarNodeId}`);

    /* ─── Gradient presets ────────────────── */
    this.$$('.gradient-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        if (snippetContainer) {
          snippetContainer.style.background = swatch.getAttribute('data-value') || '';
          snippetContainer.classList.remove('no-bg');
        }
        this.$$('.gradient-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });

    /* ─── Custom colour picker ────────────── */
    const colorPicker = this.$('#bg-color-picker') as HTMLInputElement;
    if (colorPicker && snippetContainer) {
      colorPicker.addEventListener('input', (e) => {
        const color = (e.target as HTMLInputElement).value;
        snippetContainer.style.background = color;
        snippetContainer.classList.remove('no-bg');
        this.$$('.gradient-swatch').forEach(s => s.classList.remove('active'));
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
      
      const snippetNode = this.$(`#${this.config.snippetNodeId}`);
      if (snippetNode) {
        this.$$('.line-number', snippetNode).forEach(el => {
          el.style.display = this.showLineNumbers ? '' : 'none';
        });
      }
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
    this.$('#btn-save')?.addEventListener('click', async () => {
      await this.config.onSave();
    });

    this.$('#btn-copy')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLElement;
      await this.config.onCopy(btn);
    });
  }
}

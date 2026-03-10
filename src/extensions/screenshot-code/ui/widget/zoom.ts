import './zoom.css';

export interface ZoomConfig {
  containerId: string;
}

export class ZoomWidget {
  private config: ZoomConfig;
  private currentZoom = 1;

  constructor(config: ZoomConfig) {
    this.config = config;
    this.render();
    this.attachEvents();
  }

  private $(sel: string, ctx: Document | HTMLElement = document) {
    return ctx.querySelector<HTMLElement>(sel);
  }

  private render() {
    const container = this.$(`#${this.config.containerId}`);
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div id="zoom-widget" class="zoom-widget">
        <button id="btn-zoom-out-top" class="zoom-btn" title="Zoom Out">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <span id="zoom-label-top" class="zoom-label">100%</span>
        <button id="btn-zoom-in-top" class="zoom-btn" title="Zoom In">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
    `;
  }

  private attachEvents() {
    const updateZoom = () => {
      const zoomContainer = this.$('#zoom-container');
      const zoomLabel = this.$('#zoom-label-top');
      if (zoomContainer) {
        zoomContainer.style.transform = `scale(${this.currentZoom})`;
      }
      if (zoomLabel) {
        zoomLabel.textContent = `${Math.round(this.currentZoom * 100)}%`;
      }
    };

    this.$('#btn-zoom-in-top')?.addEventListener('click', () => {
      if (this.currentZoom < 3) {
        this.currentZoom = Math.round((this.currentZoom + 0.1) * 10) / 10;
        updateZoom();
      }
    });

    this.$('#btn-zoom-out-top')?.addEventListener('click', () => {
      if (this.currentZoom > 0.3) {
        this.currentZoom = Math.round((this.currentZoom - 0.1) * 10) / 10;
        updateZoom();
      }
    });

    /* =========================================================
     * 🖱️ CTRL+WHEEL ZOOM EVENTS
     * We can also allow Ctrl+Wheel to zoom, listening on document or snippet-scroll
     * ========================================================= */
    const snippetScroll = this.$('#snippet-scroll');
    if (snippetScroll) {
      snippetScroll.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            // Zoom In
            if (this.currentZoom < 3) {
              this.currentZoom = Math.round((this.currentZoom + 0.1) * 10) / 10;
              updateZoom();
            }
          } else {
            // Zoom Out
            if (this.currentZoom > 0.3) {
              this.currentZoom = Math.round((this.currentZoom - 0.1) * 10) / 10;
              updateZoom();
            }
          }
        }
      }, { passive: false });
    }
  }
}

/**
 * Handles the raw HTML Canvas context.
 * Responsible for responding to window resizes and clearing the screen frame-by-frame.
 * Scales correctly for high-DPI displays (Retina).
 */
export class ArenaRender {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = wrapper.clientWidth * this.dpr;
    this.canvas.height = wrapper.clientHeight * this.dpr;
    this.canvas.style.width = wrapper.clientWidth + 'px';
    this.canvas.style.height = wrapper.clientHeight + 'px';
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

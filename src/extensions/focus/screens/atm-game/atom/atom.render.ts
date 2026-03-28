import { AtomEntity } from './atom.entity';

export class AtomRender {
  ctx: CanvasRenderingContext2D;
  dpr: number;

  constructor(ctx: CanvasRenderingContext2D, dpr: number) {
    this.ctx = ctx;
    this.dpr = dpr;
  }

  getAccent(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--vscode-button-background').trim() || '#555555';
  }

  draw(entity: AtomEntity, tick: number) {
    const s = this.dpr;
    const accent = this.getAccent();
    const cx = entity.x;
    const cy = entity.y;

    this.ctx.save();
    
    // Core glow (Aura)
    this.ctx.shadowColor = accent;
    this.ctx.shadowBlur = 15 * s;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1c1c1c';
    this.ctx.fill();
    
    // Inner light
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
    this.ctx.fillStyle = entity.state === 'SLEEPING' ? '#555' : accent;
    this.ctx.fill();

    // Eye / Reaction
    if (entity.state === 'CODING') {
      if (Math.floor(tick / 100) % 2 === 0) {
       this.ctx.beginPath();
       this.ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2);
       this.ctx.fillStyle = '#ffffff';
       this.ctx.fill();
      }
    } else if (entity.state === 'IDLE') {
      if (Math.floor(tick / 3000) % 2 === 0 && (tick % 3000) < 150) {
        this.ctx.fillStyle = '#1c1c1c';
        this.ctx.fillRect(cx - 6 * s, cy - 2 * s, 12 * s, 4 * s);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(cx + 2 * s, cy - 1 * s, 2 * s, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
      }
    } else if (entity.state === 'SLEEPING') {
      this.ctx.strokeStyle = '#e0e0e0';
      this.ctx.lineWidth = 2 * s;
      this.ctx.beginPath();
      this.ctx.moveTo(cx - 3 * s, cy);
      this.ctx.lineTo(cx + 3 * s, cy);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

import { GameObject } from '../arena/arena.engine';

export type PetState = 'IDLE' | 'CODING' | 'SLEEPING';

export class AtomEntity implements GameObject {
  x: number = 0;
  y: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  state: PetState = 'IDLE';

  private stateTimer: number = Date.now();
  private lastInputTime: number = Date.now();
  private cachedAccent: string | null = null;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
  }

  setState(newState: PetState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateTimer = Date.now();
  }

  onMessage(type: string): void {
    if (type === 'keystroke' || type === 'fileSaved') {
      this.setState('CODING');
      this.lastInputTime = Date.now();
    }
  }

  onBlur(): void {
    this.setState('SLEEPING');
  }

  onFocus(): void {
    if (this.state === 'SLEEPING') {
      this.setState('IDLE');
    }
  }

  input(keys: Record<string, boolean>): void {
    const moveSpeed = 5;
    if (keys['ArrowLeft']) this.targetX -= moveSpeed;
    if (keys['ArrowRight']) this.targetX += moveSpeed;
  }

  update(timestamp: number, dpr: number, canvasWidth: number, canvasHeight: number) {
    const now = Date.now();
    
    // Logic updates
    if (this.state === 'CODING' && now - this.lastInputTime > 3000) {
      this.setState('IDLE');
    }
    if (this.state === 'IDLE' && now - this.stateTimer > 300000) {
      this.setState('SLEEPING');
    }

    // Physics & Movement
    this.x += (this.targetX - this.x) * 0.1;

    let floatOffset = Math.sin(timestamp / 800) * 10 * dpr;
    if (this.state === 'SLEEPING') floatOffset = Math.sin(timestamp / 1200) * 5 * dpr;
    if (this.state === 'CODING') {
      floatOffset += (Math.random() - 0.5) * 5 * dpr;
    }
    
    this.targetY += (canvasHeight / 2 - this.targetY) * 0.05; 
    this.y = this.targetY + floatOffset;

    const margin = 20 * dpr;
    this.x = Math.max(margin, Math.min(this.x, canvasWidth - margin));
  }

  private getAccent(): string {
    if (!this.cachedAccent) {
      this.cachedAccent = getComputedStyle(document.documentElement)
        .getPropertyValue('--vscode-button-background').trim() || '#555555';
    }
    return this.cachedAccent;
  }

  draw(ctx: CanvasRenderingContext2D, dpr: number, timestamp: number): void {
    const s = dpr;
    const accent = this.getAccent();
    const { x: cx, y: cy } = this;

    ctx.save();
    
    // Core Aura
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1c';
    ctx.fill();
    
    // Inner Light
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
    ctx.fillStyle = this.state === 'SLEEPING' ? '#555' : accent;
    ctx.fill();

    // Eyes/Reaction
    if (this.state === 'CODING') {
      if (Math.floor(timestamp / 100) % 2 === 0) {
        this.drawEye(ctx, cx, cy, 3 * s, '#ffffff');
      }
    } else if (this.state === 'IDLE') {
      if (Math.floor(timestamp / 3000) % 2 === 0 && (timestamp % 3000) < 150) {
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(cx - 6 * s, cy - 2 * s, 12 * s, 4 * s);
      } else {
        this.drawEye(ctx, cx + 2 * s, cy - 1 * s, 2 * s, '#ffffff');
      }
    } else if (this.state === 'SLEEPING') {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 3 * s, cy);
      ctx.lineTo(cx + 3 * s, cy);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}


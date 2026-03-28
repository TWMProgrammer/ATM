import { GameObject } from '../arena/arena.engine';

export type PetState = 'IDLE' | 'CODING' | 'SLEEPING';

export class AtomEntity implements GameObject {
  x: number = 0;
  y: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  state: PetState = 'IDLE';

  private stateTimer: number = Date.now();
  private codingTimer: number = 0;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
  }

  setState(newState: PetState) {
    this.state = newState;
    this.stateTimer = Date.now();
  }

  onMessage(type: string, payload?: any): void {
    if (type === 'keystroke' || type === 'fileSaved') {
      this.setState('CODING');
      this.codingTimer = Date.now();
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
    this.updateLogic();

    // Smoothed movement towards target (Linear interpolation)
    this.x += (this.targetX - this.x) * 0.1;

    // Base floating Y based on tick
    let floatOffset = Math.sin(timestamp / 800) * 10 * dpr;
    if (this.state === 'SLEEPING') floatOffset = Math.sin(timestamp / 1200) * 5 * dpr;
    if (this.state === 'CODING') {
      floatOffset += (Math.random() - 0.5) * 5 * dpr; // Small glitchy movement when coding
    }
    
    // Smooth target Y movement (Center screen)
    this.targetY += (canvasHeight / 2 - this.targetY) * 0.05; 
    this.y = this.targetY + floatOffset;

    // Boundary constraints
    const margin = 20 * dpr;
    if (this.x < margin) this.x = margin;
    if (this.x > canvasWidth - margin) this.x = canvasWidth - margin;
  }

  private updateLogic() {
    const now = Date.now();
    if (this.state === 'CODING' && now - this.codingTimer > 3000) {
      this.setState('IDLE');
    }
    if (this.state === 'IDLE' && now - this.stateTimer > 300000) {
      this.setState('SLEEPING');
    }
  }

  // --- Rendering ---
  private cachedAccent: string | null = null;

  private getAccent(): string {
    if (!this.cachedAccent) {
      this.cachedAccent = getComputedStyle(document.documentElement).getPropertyValue('--vscode-button-background').trim() || '#555555';
    }
    return this.cachedAccent;
  }

  draw(ctx: CanvasRenderingContext2D, dpr: number, timestamp: number): void {
    const s = dpr;
    const accent = this.getAccent();
    const cx = this.x;
    const cy = this.y;

    ctx.save();
    
    // Core glow (Aura)
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1c';
    ctx.fill();
    
    // Inner light
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
    ctx.fillStyle = this.state === 'SLEEPING' ? '#555' : accent;
    ctx.fill();

    // Eye / Reaction patterns
    if (this.state === 'CODING') {
      if (Math.floor(timestamp / 100) % 2 === 0) {
       ctx.beginPath();
       ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2);
       ctx.fillStyle = '#ffffff';
       ctx.fill();
      }
    } else if (this.state === 'IDLE') {
      if (Math.floor(timestamp / 3000) % 2 === 0 && (timestamp % 3000) < 150) {
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(cx - 6 * s, cy - 2 * s, 12 * s, 4 * s);
      } else {
        ctx.beginPath();
        ctx.arc(cx + 2 * s, cy - 1 * s, 2 * s, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
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
}

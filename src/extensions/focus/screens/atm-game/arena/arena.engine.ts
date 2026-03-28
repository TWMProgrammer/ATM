import { ArenaRender } from './arena.render';
import { AtomEntity } from '../atom/atom.entity';
import { AtomRender } from '../atom/atom.render';

export class ArenaEngine {
  canvas: HTMLCanvasElement | null;
  arenaRender: ArenaRender | null = null;
  atomRender: AtomRender | null = null;
  atom: AtomEntity | null = null;
  
  keys: { [key: string]: boolean } = {};
  animationFrameId: number = 0;
  
  stateTimer: number = Date.now();
  codingTimer: number = 0;
  
  ro: ResizeObserver | null = null;

  constructor() {
    this.canvas = document.getElementById('atomCanvas') as HTMLCanvasElement | null;
  }

  start() {
    if (!this.canvas) return;

    this.arenaRender = new ArenaRender(this.canvas);
    this.arenaRender.resize();

    this.atomRender = new AtomRender(this.arenaRender.ctx, this.arenaRender.dpr);
    this.atom = new AtomEntity(this.canvas.width / 2, this.canvas.height / 2);

    this.ro = new ResizeObserver(() => {
      if (this.arenaRender) {
        this.arenaRender.resize();
        if (this.atomRender) this.atomRender.dpr = this.arenaRender.dpr;
      }
    });
    if (this.canvas.parentElement) {
      this.ro.observe(this.canvas.parentElement);
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('message', this.handleMessage);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);

    // Initial sync
    document.addEventListener('DOMContentLoaded', () => {
      if (this.arenaRender) this.arenaRender.resize();
    });

    this.loop(0);
  }

  private handleKeyDown = (e: KeyboardEvent) => { this.keys[e.key] = true; }
  private handleKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; }

  private handleMessage = (e: MessageEvent) => {
    if (!e.data || !e.data.type || !this.atom) return;
    if (e.data.type === 'keystroke' || e.data.type === 'fileSaved') {
      this.atom.setState('CODING');
      this.codingTimer = Date.now();
      this.stateTimer = Date.now();
    }
  }

  private handleBlur = () => { if (this.atom) this.atom.setState('SLEEPING'); }
  private handleFocus = () => { if (this.atom && this.atom.state === 'SLEEPING') this.atom.setState('IDLE'); }

  private loop = (timestamp: number) => {
    this.animationFrameId = requestAnimationFrame(this.loop);
    if (!this.arenaRender || !this.atom || !this.atomRender || !this.canvas) return;

    this.updateLogic();
    
    this.atom.input(this.keys, 5 * this.arenaRender.dpr);
    this.atom.update(timestamp, this.arenaRender.dpr, this.canvas.width, this.canvas.height);

    this.arenaRender.clear();
    this.atomRender.draw(this.atom, timestamp);
  }

  private updateLogic() {
    const now = Date.now();
    if (!this.atom) return;

    if (this.atom.state === 'CODING' && now - this.codingTimer > 3000) {
      this.atom.setState('IDLE');
      this.stateTimer = now;
    }
    if (this.atom.state === 'IDLE' && now - this.stateTimer > 300000) {
      this.atom.setState('SLEEPING');
    }
  }

  stop() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('message', this.handleMessage);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
    if (this.ro) this.ro.disconnect();
  }
}

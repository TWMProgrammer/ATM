import { ArenaRender } from './arena.render';

export interface GameObject {
  update(timestamp: number, dpr: number, width: number, height: number): void;
  draw(ctx: CanvasRenderingContext2D, dpr: number, timestamp: number): void;
  input?(keys: Record<string, boolean>): void;
  onMessage?(type: string, payload?: any): void;
  onBlur?(): void;
  onFocus?(): void;
}

export class ArenaEngine {
  canvas: HTMLCanvasElement | null = null;
  arenaRender: ArenaRender | null = null;
  
  private gameObjects: GameObject[] = [];
  private keys: Record<string, boolean> = {};
  private animationFrameId: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.canvas = document.getElementById('atomCanvas') as HTMLCanvasElement | null;
  }

  addGameObject(obj: GameObject) {
    this.gameObjects.push(obj);
  }

  start() {
    if (!this.canvas || this.isRunning) return;
    this.isRunning = true;

    this.arenaRender = new ArenaRender(this.canvas);
    this.arenaRender.resize();

    this.resizeObserver = new ResizeObserver(() => {
      this.arenaRender?.resize();
    });

    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    this.bindEvents();
    this.loop(0);
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('message', this.handleMessage);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('message', this.handleMessage);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
  }

  private handleKeyDown = (e: KeyboardEvent) => { this.keys[e.key] = true; }
  private handleKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; }

  private handleMessage = (e: MessageEvent) => {
    if (!e.data?.type) return;
    this.gameObjects.forEach(obj => obj.onMessage?.(e.data.type, e.data));
  }

  private handleBlur = () => this.gameObjects.forEach(obj => obj.onBlur?.());
  private handleFocus = () => this.gameObjects.forEach(obj => obj.onFocus?.());

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);
    
    if (!this.arenaRender || !this.canvas) return;
    
    this.arenaRender.clear();

    const dpr = this.arenaRender.dpr;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.arenaRender.ctx;

    for (const obj of this.gameObjects) {
      obj.input?.(this.keys);
      obj.update(timestamp, dpr, w, h);
      obj.draw(ctx, dpr, timestamp);
    }
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
    this.unbindEvents();
    this.resizeObserver?.disconnect();
  }
}


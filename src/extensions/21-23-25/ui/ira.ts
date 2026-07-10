/* ATM IRA — launcher webview script.
 *
 * Registers the <pixel-canvas> shimmer element (a canvas grid of pixels that
 * bloom from the center outward on hover/focus and dissolve on leave) and
 * forwards card activations back to the extension host so each tile can launch
 * its feature command. */

type LaunchAction = 'browser' | 'compare' | 'translate' | 'git';

interface LaunchMessage {
	readonly type: 'launch';
	readonly action: LaunchAction;
}

interface VsCodeApi {
	postMessage(msg: unknown): void;
}

declare const acquireVsCodeApi: () => VsCodeApi;

const vscodeApi = acquireVsCodeApi();

function launch(action: LaunchAction): void {
	const message: LaunchMessage = { type: 'launch', action };
	vscodeApi.postMessage(message);
}

/* ------------------------------------------------------------------ */
/* pixel-canvas shimmer                                                */
/* ------------------------------------------------------------------ */

class Pixel {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly x: number;
	private readonly y: number;
	private readonly color: string;
	private readonly speed: number;
	private readonly sizeStep: number;
	private readonly minSize = 0.5;
	private readonly maxSizeInteger = 2;
	private readonly maxSize: number;
	private readonly delay: number;
	private readonly counterStep: number;
	private size = 0;
	private counter = 0;
	isIdle = false;
	private isReverse = false;
	private isShimmer = false;

	constructor(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		x: number,
		y: number,
		color: string,
		speed: number,
		delay: number,
	) {
		this.ctx = ctx;
		this.x = x;
		this.y = y;
		this.color = color;
		this.speed = this.getRandomValue(0.1, 0.9) * speed;
		this.sizeStep = Math.random() * 0.4;
		this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
		this.delay = delay;
		this.counterStep = Math.random() * 4 + (width + height) * 0.01;
	}

	private getRandomValue(min: number, max: number): number {
		return Math.random() * (max - min) + min;
	}

	draw(): void {
		const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
		this.ctx.fillStyle = this.color;
		this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
	}

	appear(): void {
		this.isIdle = false;

		if (this.counter <= this.delay) {
			this.counter += this.counterStep;
			return;
		}

		if (this.size >= this.maxSize) {
			this.isShimmer = true;
		}

		if (this.isShimmer) {
			this.shimmer();
		} else {
			this.size += this.sizeStep;
		}

		this.draw();
	}

	disappear(): void {
		this.isShimmer = false;
		this.counter = 0;

		if (this.size <= 0) {
			this.isIdle = true;
			return;
		}

		this.size -= 0.1;
		this.draw();
	}

	private shimmer(): void {
		if (this.size >= this.maxSize) {
			this.isReverse = true;
		} else if (this.size <= this.minSize) {
			this.isReverse = false;
		}

		if (this.isReverse) {
			this.size -= this.speed;
		} else {
			this.size += this.speed;
		}
	}
}

class PixelCanvas extends HTMLElement {
	static css = `
		:host {
			display: grid;
			inline-size: 100%;
			block-size: 100%;
			overflow: hidden;
		}
	`;

	private canvas!: HTMLCanvasElement;
	private ctx!: CanvasRenderingContext2D;
	private pixels: Pixel[] = [];
	private timeInterval = 1000 / 60;
	private timePrevious = 0;
	private reducedMotion = false;
	private resizeObserver!: ResizeObserver;
	private animation = 0;
	private parent: HTMLElement | null = null;

	static register(tag = 'pixel-canvas'): void {
		if ('customElements' in window) {
			customElements.define(tag, PixelCanvas);
		}
	}

	get colors(): string[] {
		return this.dataset.colors?.split(',') ?? ['#f8fafc', '#f1f5f9', '#cbd5e1'];
	}

	get gap(): number {
		const value = Number(this.dataset.gap) || 5;
		const min = 4;
		const max = 50;

		if (value <= min) {
			return min;
		}

		if (value >= max) {
			return max;
		}

		return value;
	}

	get speed(): number {
		const value = Number(this.dataset.speed) || 35;
		const min = 0;
		const max = 100;
		const throttle = 0.001;

		if (value <= min || this.reducedMotion) {
			return min;
		}

		if (value >= max) {
			return max * throttle;
		}

		return value * throttle;
	}

	get noFocus(): boolean {
		return this.hasAttribute('data-no-focus');
	}

	connectedCallback(): void {
		const canvas = document.createElement('canvas');
		const sheet = new CSSStyleSheet();
		this.parent = this.parentNode as HTMLElement | null;
		const root = this.attachShadow({ mode: 'open' });

		sheet.replaceSync(PixelCanvas.css);
		root.adoptedStyleSheets = [sheet];
		root.append(canvas);
		this.canvas = root.querySelector('canvas') as HTMLCanvasElement;
		this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		this.timePrevious = performance.now();
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		this.init();
		this.resizeObserver = new ResizeObserver(() => this.init());
		this.resizeObserver.observe(this);

		const parent = this.parent;
		if (!parent) {
			return;
		}

		parent.addEventListener('mouseenter', this);
		parent.addEventListener('mouseleave', this);

		if (!this.noFocus) {
			parent.addEventListener('focusin', this);
			parent.addEventListener('focusout', this);
		}
	}

	disconnectedCallback(): void {
		this.resizeObserver.disconnect();

		const parent = this.parent;
		if (parent) {
			parent.removeEventListener('mouseenter', this);
			parent.removeEventListener('mouseleave', this);

			if (!this.noFocus) {
				parent.removeEventListener('focusin', this);
				parent.removeEventListener('focusout', this);
			}
		}

		this.parent = null;
	}

	handleEvent(event: Event): void {
		const related = (event as FocusEvent).relatedTarget as Node | null;
		const current = event.currentTarget as HTMLElement | null;

		switch (event.type) {
			case 'mouseenter':
				this.handleAnimation('appear');
				break;
			case 'mouseleave':
				this.handleAnimation('disappear');
				break;
			case 'focusin':
				if (current && related && current.contains(related)) {
					return;
				}
				this.handleAnimation('appear');
				break;
			case 'focusout':
				if (current && related && current.contains(related)) {
					return;
				}
				this.handleAnimation('disappear');
				break;
			default:
				break;
		}
	}

	private handleAnimation(name: 'appear' | 'disappear'): void {
		cancelAnimationFrame(this.animation);
		this.animation = requestAnimationFrame(() => this.runFrame(name));
	}

	private init(): void {
		const rect = this.getBoundingClientRect();
		const width = Math.floor(rect.width);
		const height = Math.floor(rect.height);

		this.pixels = [];
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.createPixels();
	}

	private getDistanceToCanvasCenter(x: number, y: number): number {
		const dx = x - this.canvas.width / 2;
		const dy = y - this.canvas.height / 2;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private createPixels(): void {
		for (let x = 0; x < this.canvas.width; x += this.gap) {
			for (let y = 0; y < this.canvas.height; y += this.gap) {
				const color = this.colors[Math.floor(Math.random() * this.colors.length)];
				const delay = this.reducedMotion ? 0 : this.getDistanceToCanvasCenter(x, y);
				this.pixels.push(
					new Pixel(this.ctx, this.canvas.width, this.canvas.height, x, y, color, this.speed, delay),
				);
			}
		}
	}

	private runFrame(fnName: 'appear' | 'disappear'): void {
		this.animation = requestAnimationFrame(() => this.runFrame(fnName));

		const timeNow = performance.now();
		const timePassed = timeNow - this.timePrevious;

		if (timePassed < this.timeInterval) {
			return;
		}

		this.timePrevious = timeNow - (timePassed % this.timeInterval);

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		for (let i = 0; i < this.pixels.length; i++) {
			this.pixels[i][fnName]();
		}

		if (this.pixels.every(pixel => pixel.isIdle)) {
			cancelAnimationFrame(this.animation);
		}
	}
}

PixelCanvas.register();

/* ------------------------------------------------------------------ */
/* card activation                                                     */
/* ------------------------------------------------------------------ */

function launchFromCard(card: HTMLElement): void {
	const action = card.dataset.action as LaunchAction | undefined;
	if (!action) {
		return;
	}
	launch(action);
}

document.addEventListener('click', event => {
	const target = event.target as HTMLElement | null;
	const card = target?.closest<HTMLElement>('[data-action]');
	if (card) {
		launchFromCard(card);
	}
});

document.addEventListener('keydown', event => {
	if (event.key !== 'Enter' && event.key !== ' ') {
		return;
	}

	const target = event.target as HTMLElement | null;
	const card = target?.closest<HTMLElement>('[data-action]');
	if (!card) {
		return;
	}

	event.preventDefault();
	launchFromCard(card);
});

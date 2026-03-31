/**
 * ATM Data — Carousel UI Controller
 * GPU-optimized pill carousel with requestAnimationFrame transitions.
 * Subscribes to the reactive DataState for real-time updates.
 */

import { $ } from '../../../shared/utils';
import { dataState, StatEntry, bindMessageListener } from './plus/state';
import { NicknameController } from './plus/nickname';

import { getVsCodeApi } from './plus/vscode-api';

// --- DOM Cache (queried once) ---
interface PillElements {
  pill: HTMLElement;
  circle: HTMLElement;
  value: HTMLElement;
}

let leftPill:   PillElements | null = null;
let centerPill: PillElements | null = null;
let rightPill:  PillElements | null = null;
let prevBtn:    HTMLElement | null = null;
let nextBtn:    HTMLElement | null = null;

let currentIndex = 0;
let isAnimating  = false;
let nicknameCtrl: NicknameController | null = null;

/** Cache a pill's inner elements to avoid querySelector on every frame. */
function cachePill(id: string): PillElements | null {
  const pill = $(id);
  if (!pill) { return null; }
  return {
    pill,
    circle: pill.querySelector('.day-circle') as HTMLElement,
    value:  pill.querySelector('.pill-value')  as HTMLElement,
  };
}

/** Safely inject SVG markup using a sandboxed template element (no XSS risk). */
function safeSetSVG(element: HTMLElement, svgHtml: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = svgHtml;
  element.replaceChildren(tpl.content.cloneNode(true));
}

/** Apply stat data to a cached pill (no DOM query, direct property set). */
function applyStatToPill(cached: PillElements, stat: StatEntry): void {
  safeSetSVG(cached.circle, stat.icon);
  cached.value.textContent = stat.value;
  cached.value.id = stat.id;

  // Swap theme class (remove old, add new)
  const classList = cached.pill.classList;
  for (let i = classList.length - 1; i >= 0; i--) {
    if (classList[i].startsWith('theme-')) { classList.remove(classList[i]); }
  }
  const themeClass = stat.id.replace('stat-', 'theme-');
  classList.add(themeClass);
  cached.pill.title = stat.label;
  
  // Sync background orb color if center pill
  if (cached.pill.classList.contains('center-pill')) {
     const orbColors: Record<string, string> = {
         'theme-time': 'rgba(6, 182, 212, 0.15)',
         'theme-commits': 'rgba(16, 185, 129, 0.15)',
         'theme-files': 'rgba(168, 85, 247, 0.15)',
         'theme-streak': 'rgba(249, 115, 22, 0.15)'
     };
     const orb = $('.glow-orb');
     if (orb) {
         orb.style.setProperty('--orb-color', orbColors[themeClass] || 'rgba(59, 130, 246, 0.15)');
     }
  }
}

/**
 * Animates a pill transition using CSS transforms (GPU-composited).
 * Uses requestAnimationFrame for precise timing instead of setTimeout chains.
 */
function animatePill(
  cached: PillElements | null,
  stat: StatEntry,
  isCenter: boolean,
  direction: number,
): void {
  if (!cached) { return; }

  const { pill } = cached;
  const exitX  = isCenter ? `${direction * -22}px` : '0px';
  const enterX = isCenter ? `${direction *  18}px` : '0px';
  const exitScale  = isCenter ? 0.86 : 0.82;
  const enterScale = isCenter ? 0.90 : 0.90;

  // Phase 1: exit (fade out + slide)
  pill.classList.remove('pill-land');
  pill.style.transition = 'opacity 0.13s ease, transform 0.13s ease';
  pill.style.opacity = '0';
  pill.style.transform = `translateX(${exitX}) scale(${exitScale})`;

  // Schedule phase 2 after exit completes
  requestAnimationFrame(() => {
    setTimeout(() => {
      // Swap content while invisible
      applyStatToPill(cached, stat);

      // Position at entrance point (no transition)
      pill.style.transition = 'none';
      pill.style.transform = `translateX(${enterX}) scale(${enterScale})`;

      // Force layout recalc before animating in
      void pill.offsetHeight;

      // Phase 2: enter (spring for center, ease for sides)
      requestAnimationFrame(() => {
        const easing = isCenter
          ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'cubic-bezier(0.25, 0.8, 0.25, 1)';
        pill.style.transition = `opacity 0.20s ease, transform 0.28s ${easing}`;
        pill.style.opacity = '1';
        pill.style.transform = 'translateX(0) scale(1)';

        // Glow-pulse on center landing
        if (isCenter) {
          setTimeout(() => {
            pill.classList.add('pill-land');
            setTimeout(() => pill.classList.remove('pill-land'), 500);
          }, 200);
        }
      });
    }, 120);
  });
}

/** Render all 3 pills for the current index with directional animation. */
function updateCarousel(direction: number): void {
  if (isAnimating) { return; }
  isAnimating = true;

  const stats = dataState.getStats();
  const total = stats.length;
  const leftIdx  = (currentIndex - 1 + total) % total;
  const rightIdx = (currentIndex + 1) % total;

  animatePill(leftPill,   stats[leftIdx],      false, direction);
  animatePill(centerPill, stats[currentIndex],  true,  direction);
  animatePill(rightPill,  stats[rightIdx],      false, direction);

  // Unlock after full animation cycle (exit + enter)
  setTimeout(() => { isAnimating = false; }, 320);
}

/** Set all 3 pills instantly (no animation, used on first render). */
function renderStatic(): void {
  const stats = dataState.getStats();
  const total = stats.length;

  const pairs: [PillElements | null, number][] = [
    [leftPill,   (currentIndex - 1 + total) % total],
    [centerPill, currentIndex],
    [rightPill,  (currentIndex + 1) % total],
  ];

  for (const [cached, idx] of pairs) {
    if (!cached) { continue; }
    applyStatToPill(cached, stats[idx]);
    cached.pill.style.opacity = '1';
    cached.pill.style.transform = 'translateX(0) scale(1)';
  }
}

/**
 * Re-render visible pills in-place when data changes (no carousel animation).
 * Only updates the text values, preserving the current visual state.
 */
function onStatsChanged(stats: readonly StatEntry[]): void {
  const total = stats.length;

  const pairs: [PillElements | null, number][] = [
    [leftPill,   (currentIndex - 1 + total) % total],
    [centerPill, currentIndex],
    [rightPill,  (currentIndex + 1) % total],
  ];

  for (const [cached, idx] of pairs) {
    if (!cached) { continue; }
    const stat = stats[idx];
    // Only update text — no icon/theme swap to avoid visual jank
    cached.value.textContent = stat.value;
  }
}

/** Main initialization — called once from data.ts entry point. */
export function initDataUI(): void {
  const root = $('#atm-data-root');
  if (!root) { return; }

  // Cache DOM elements once
  leftPill   = cachePill('#pill-left');
  centerPill = cachePill('#pill-center');
  rightPill  = cachePill('#pill-right');
  prevBtn    = $('#nav-prev');
  nextBtn    = $('#nav-next');

  // Set initial index (start on commits)
  currentIndex = 1;

  // Initial static render
  renderStatic();

  // Bind carousel navigation
  prevBtn?.addEventListener('click', () => {
    const total = dataState.getStats().length;
    currentIndex = (currentIndex - 1 + total) % total;
    updateCarousel(-1);
  });

  nextBtn?.addEventListener('click', () => {
    const total = dataState.getStats().length;
    currentIndex = (currentIndex + 1) % total;
    updateCarousel(1);
  });

  // Subscribe to live data updates from state
  dataState.subscribe(onStatsChanged);

  // Start listening for Extension Host messages
  bindMessageListener();

  // Initialize nickname module
  nicknameCtrl = new NicknameController();

  // Request initial stats from the extension host
  const vscodeApi = getVsCodeApi();
  if (vscodeApi) {
      vscodeApi.postMessage({ type: 'request_stats_update' });
  }
}

/** Get the nickname controller (for share button, etc.) */
export function getNicknameController(): NicknameController | null {
  return nicknameCtrl;
}

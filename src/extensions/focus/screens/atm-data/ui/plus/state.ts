/**
 * ATM Data — Reactive State Manager
 * Centralized state for developer stats with observer pattern.
 * Listens for real data from the Extension Host via postMessage.
 */

export interface StatEntry {
  id: string;
  icon: string;
  value: string;
  label: string;
}

export type StatsListener = (stats: readonly StatEntry[]) => void;

// SVG icons — defined once, referenced everywhere
const ICONS = {
  time: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  commits: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path><path d="M12 12v3"></path></svg>',
  files: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path><path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8"></path><path d="M15 2v5h5"></path></svg>',
  streak: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
} as const;

/** Default stats shown on first load (before real data arrives) */
function createDefaultStats(): StatEntry[] {
  return [
    { id: 'stat-commits', icon: ICONS.commits, value: '0',   label: 'Commits Hoy' },
    { id: 'stat-time',    icon: ICONS.time,    value: '0m',  label: 'Tiempo en VS Code' },
    { id: 'stat-files',   icon: ICONS.files,   value: '0',   label: 'Archivos Tocados' },
    { id: 'stat-streak',  icon: ICONS.streak,  value: '0',   label: 'Días de Racha' },
  ];
}

class DataState {
  private stats: StatEntry[] = createDefaultStats();
  private listeners: Set<StatsListener> = new Set();

  /** Subscribe to stats changes. Returns unsubscribe function. */
  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    listener(this.stats); // emit current state immediately
    return () => this.listeners.delete(listener);
  }

  /** Get current stats (read-only snapshot). */
  getStats(): readonly StatEntry[] {
    return this.stats;
  }

  /** Update a single stat by id. Only notifies if value changed. */
  updateStat(id: string, value: string): void {
    const entry = this.stats.find(s => s.id === id);
    if (!entry || entry.value === value) { return; }
    entry.value = value;
    this.notify();
  }

  /** Batch update all stats at once. */
  updateAll(data: Partial<Record<string, string>>): void {
    let changed = false;
    for (const entry of this.stats) {
      const newValue = data[entry.id];
      if (newValue !== undefined && entry.value !== newValue) {
        entry.value = newValue;
        changed = true;
      }
    }
    if (changed) { this.notify(); }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.stats);
    }
  }
}

/** Singleton state instance */
export const dataState = new DataState();

/**
 * Binds the Extension Host message listener.
 * Expected message format from backend:
 *   { type: 'statsUpdate', stats: { 'stat-time': '2h 14m', 'stat-commits': '7', ... } }
 */
export function bindMessageListener(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data;
    if (msg?.type === 'statsUpdate' && msg.stats) {
      dataState.updateAll(msg.stats);
    }
  });
}

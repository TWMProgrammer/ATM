/**
 * ATM Data — Nickname Modal Controller
 * Isolated logic for the nickname input modal.
 * Handles first-launch detection, save/close, and header sync.
 */

import { $ } from '../../../../shared/utils';

declare function acquireVsCodeApi(): any;

const STORAGE_KEY = 'atm_game_nickname';
const DEFAULT_NAME = 'Player';
const MAX_LENGTH = 15;

/** Sanitize raw user input into a safe nickname string. */
function sanitize(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, MAX_LENGTH) || DEFAULT_NAME;
}

export class NicknameController {
  private currentNickname: string;
  private nicknameEl: HTMLElement | null;
  private modal: HTMLElement | null;
  private input: HTMLInputElement | null;
  private saveBtn: HTMLButtonElement | null;
  private closeBtn: HTMLButtonElement | null;

  constructor() {
    this.nicknameEl = $('#atom-nickname');
    this.modal      = $('#nickname-modal');
    this.input      = $('#nickname-input') as HTMLInputElement | null;
    this.saveBtn    = $('#nickname-save-btn') as HTMLButtonElement | null;
    this.closeBtn   = $('#nickname-close-btn') as HTMLButtonElement | null;
    this.currentNickname = localStorage.getItem(STORAGE_KEY) || '';

    this.bindEvents();
    this.init();
  }

  /** Get the current nickname (prefixed with @). */
  getNickname(): string {
    return `@${this.currentNickname || DEFAULT_NAME}`;
  }

  private init(): void {
    if (!this.currentNickname) {
      this.showModal();
    } else {
      this.updateUI(this.currentNickname);
    }
  }

  private bindEvents(): void {
    this.saveBtn?.addEventListener('click', () => this.save(this.input?.value ?? null));

    this.input?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') { this.save(this.input?.value ?? null); }
    });

    this.closeBtn?.addEventListener('click', () => this.save(null));

    this.nicknameEl?.addEventListener('click', () => this.showModal());
  }

  private save(rawName: string | null): void {
    const fallback = this.currentNickname || DEFAULT_NAME;
    const safeName = (rawName !== null && rawName.trim() !== '') ? rawName : fallback;
    this.currentNickname = sanitize(safeName);

    localStorage.setItem(STORAGE_KEY, this.currentNickname);
    this.updateUI(this.currentNickname);
    this.hideModal();
    
    if (!(window as any).vscode) {
        try { (window as any).vscode = acquireVsCodeApi(); } catch (e) {}
    }
    const vscodeApi = (window as any).vscode;
    if (vscodeApi) {
        vscodeApi.postMessage({ type: 'nickname_updated', nickname: this.currentNickname });
    } else {
        window.postMessage({ type: 'nickname_updated', nickname: this.currentNickname }, '*'); 
    }
  }

  private updateUI(name: string): void {
    if (this.nicknameEl) { this.nicknameEl.textContent = `@${name}`; }
  }

  private showModal(): void {
    if (!this.modal || !this.input) { return; }
    this.input.value = this.currentNickname || '';
    this.modal.classList.remove('hidden');
    setTimeout(() => this.input?.focus(), 80);
  }

  private hideModal(): void {
    this.modal?.classList.add('hidden');
  }
}

'use strict';

import * as vscode from 'vscode';

// ======================================
// RUN DEV — PSEUDOTERMINAL | MARK: PTY
// ======================================
//
// A pure "view" over the spawned dev process: it renders output in a real
// VS Code terminal and forwards the user's keystrokes back to the controller
// (which pipes them to the child, mapping Ctrl+C to a group interrupt). The
// process itself lives in the controller, so output can still be scanned for
// the URL even before the terminal panel is shown.

const CTRL_C = '\x03'; // ETX — what a terminal sends on Ctrl+C

export interface DevTerminalHandlers {
  /** A keystroke that is NOT Ctrl+C — forward to the child's stdin. */
  onInput(data: string): void;
  /** The user pressed Ctrl+C in the terminal. */
  onInterrupt(): void;
  /** The terminal was closed (by the user or by us disposing it). */
  onClose(): void;
}

export class DevTerminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;
  private readonly closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidClose = this.closeEmitter.event;

  private opened = false;
  private closed = false;
  private buffer: string[] = [];

  constructor(private readonly handlers: DevTerminalHandlers) {}

  // --- Pseudoterminal contract ---

  open(): void {
    this.opened = true;
    for (const chunk of this.buffer) {
      this.writeEmitter.fire(chunk);
    }
    this.buffer = [];
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.handlers.onClose();
  }

  handleInput(data: string): void {
    if (data === CTRL_C) {
      this.handlers.onInterrupt();
    } else {
      this.handlers.onInput(data);
    }
  }

  // --- Driven by the controller ---

  /** Render a chunk of child output (newlines normalised for the terminal). */
  write(text: string): void {
    const normalised = text.replace(/\r?\n/g, '\r\n');
    if (this.opened) {
      this.writeEmitter.fire(normalised);
    } else {
      this.buffer.push(normalised); // shown once open() fires
    }
  }

  /** Print a dim footer after the process exits (terminal stays open to read). */
  writeExit(code: number | null): void {
    const label = code === null ? 'terminated' : `exited with code ${code}`;
    this.write(`\r\n\x1b[2m[ATM Run Dev] dev server ${label}\x1b[0m\r\n`);
  }
}

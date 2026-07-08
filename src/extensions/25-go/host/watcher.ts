'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { GoLiveConfig } from './config';

// ======================================
// GO LIVE — FILE WATCHER | MARK: WATCHER
// ======================================
//
// Replaces chokidar with VS Code's own recursive watcher. Changes are
// debounced, filtered against the ignore globs, and classified: pure CSS edits
// trigger a hot swap, everything else a full reload.

export interface ReloadTarget {
  reload(): void;
  reloadCss(): void;
}

export class ReloadWatcher {
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly ignore: RegExp[];
  private readonly workspacePath: string;
  private readonly wait: number;
  private readonly fullReload: boolean;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private needsFullReload = false;

  constructor(rootDir: string, workspacePath: string, private readonly target: ReloadTarget) {
    this.workspacePath = workspacePath;
    this.wait = GoLiveConfig.wait;
    this.fullReload = GoLiveConfig.fullReload;
    this.ignore = GoLiveConfig.ignoreFiles.map(globToRegExp);

    const pattern = new vscode.RelativePattern(vscode.Uri.file(rootDir), '**/*');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const onChange = (uri: vscode.Uri): void => this.onFsEvent(uri);
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate(onChange),
      this.watcher.onDidChange(onChange),
      this.watcher.onDidDelete(onChange)
    );
  }

  private onFsEvent(uri: vscode.Uri): void {
    if (this.isIgnored(uri.fsPath)) {
      return;
    }
    // A create/delete changes the file tree itself, so always full-reload for
    // those; only in-place CSS edits qualify for a hot swap.
    const isCss = path.extname(uri.fsPath).toLowerCase() === '.css';
    if (!isCss || this.fullReload) {
      this.needsFullReload = true;
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.wait);
  }

  private flush(): void {
    this.timer = undefined;
    if (this.needsFullReload) {
      this.needsFullReload = false;
      this.target.reload();
    } else {
      this.target.reloadCss();
    }
  }

  private isIgnored(fsPath: string): boolean {
    if (this.ignore.length === 0) {
      return false;
    }
    const rel = path.relative(this.workspacePath, fsPath).split(path.sep).join('/');
    const abs = fsPath.split(path.sep).join('/');
    return this.ignore.some((re) => re.test(rel) || re.test(abs));
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

/** Convert a glob (supporting **, *, ?) into an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
  const normalized = glob.split(path.sep).join('/');
  let re = '';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '*') {
      if (normalized[i + 1] === '*') {
        if (normalized[i + 2] === '/') {
          re += '(?:.*/)?'; // "**/" spans zero or more path segments
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (char === '?') {
      re += '[^/]';
    } else {
      re += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

'use strict';

import { spawn, ChildProcess } from 'child_process';

// ======================================
// RUN DEV — PROCESS TREE | MARK: PROCESS
// ======================================
//
// Spawns the dev-server command and, crucially, can tear down the WHOLE process
// tree it creates. Dev servers fork children (bundler, workers), so a plain
// child.kill() would orphan them and leave the port held. On POSIX we run the
// child as a process-group leader (`detached`) and signal the negative PID; on
// Windows we let `taskkill /T` walk the tree.

const isWindows = process.platform === 'win32';

export interface DevProcessOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface DevProcess {
  readonly pid: number | undefined;
  /** Merged stdout + stderr, decoded as UTF-8. */
  onData(callback: (chunk: string) => void): void;
  onExit(callback: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  /** Forward keystrokes (terminal input) to the child's stdin. */
  write(data: string): void;
  /** Ctrl+C — SIGINT the whole group (best-effort force-kill on Windows). */
  interrupt(): void;
  /** Graceful SIGTERM, escalating to SIGKILL after a grace period. */
  kill(): void;
}

export function spawnDev(command: string, args: string[], options: DevProcessOptions): DevProcess {
  const child: ChildProcess = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    detached: !isWindows, // own process group on POSIX so we can signal the tree
    shell: isWindows, // resolve npm.cmd / pnpm.cmd / … on Windows
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  const dataCallbacks: Array<(chunk: string) => void> = [];
  const exitCallbacks: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];
  const emitData = (chunk: string): void => {
    for (const cb of dataCallbacks) {
      cb(chunk);
    }
  };

  child.stdout?.on('data', emitData);
  child.stderr?.on('data', emitData);
  child.on('exit', (code, signal) => {
    for (const cb of exitCallbacks) {
      cb(code, signal);
    }
  });
  child.on('error', (error) => {
    emitData(`\n[ATM Run Dev] failed to start "${command}": ${error.message}\n`);
    for (const cb of exitCallbacks) {
      cb(-1, null);
    }
  });

  let killTimer: ReturnType<typeof setTimeout> | undefined;

  const signalTree = (signal: NodeJS.Signals): void => {
    const pid = child.pid;
    if (pid === undefined) {
      return;
    }
    try {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
      } else {
        process.kill(-pid, signal); // negative PID → the whole process group
      }
    } catch {
      // Already exited — nothing to signal.
    }
  };

  return {
    get pid(): number | undefined {
      return child.pid;
    },
    onData(callback): void {
      dataCallbacks.push(callback);
    },
    onExit(callback): void {
      exitCallbacks.push(callback);
    },
    write(data): void {
      try {
        child.stdin?.write(data);
      } catch {
        // stdin closed — ignore.
      }
    },
    interrupt(): void {
      // Windows has no clean SIGINT for a child tree without a native pty, so we
      // fall back to taskkill there.
      signalTree(isWindows ? 'SIGTERM' : 'SIGINT');
    },
    kill(): void {
      signalTree('SIGTERM');
      if (!isWindows) {
        killTimer = setTimeout(() => signalTree('SIGKILL'), 3000);
        killTimer.unref?.();
      }
      child.once('exit', () => {
        if (killTimer) {
          clearTimeout(killTimer);
        }
      });
    },
  };
}

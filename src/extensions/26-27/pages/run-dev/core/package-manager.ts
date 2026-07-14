'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { PackageManifest } from './manifest';

// ======================================
// RUN DEV — PACKAGE MANAGER | MARK: PM
// ======================================
//
// Figures out which package manager a project uses so we can run its own dev
// script the same way the user would. Precedence: the Corepack `packageManager`
// field (authoritative) → lockfile → first one installed on PATH → npm.

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

const ALL: readonly PackageManager[] = ['bun', 'pnpm', 'yarn', 'npm'];

const LOCKFILES: ReadonlyArray<[string, PackageManager]> = [
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];

function fromCorepackField(manifest?: PackageManifest): PackageManager | undefined {
  const field = manifest?.packageManager;
  if (typeof field !== 'string') {
    return undefined;
  }
  const name = field.split('@')[0]?.trim();
  return (ALL as readonly string[]).includes(name) ? (name as PackageManager) : undefined;
}

function fromLockfile(dir: string): PackageManager | undefined {
  for (const [file, manager] of LOCKFILES) {
    if (fs.existsSync(path.join(dir, file))) {
      return manager;
    }
  }
  return undefined;
}

function isOnPath(binary: string): boolean {
  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  const candidates =
    process.platform === 'win32' ? [`${binary}.cmd`, `${binary}.exe`, binary] : [binary];
  for (const dir of dirs) {
    if (!dir) {
      continue;
    }
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(dir, candidate))) {
        return true;
      }
    }
  }
  return false;
}

/** Resolve the package manager for a project, honouring an explicit override. */
export function detectPackageManager(
  dir: string,
  manifest?: PackageManifest,
  override?: PackageManager | 'auto'
): PackageManager {
  if (override && override !== 'auto') {
    return override;
  }
  return (
    fromCorepackField(manifest) ??
    fromLockfile(dir) ??
    ALL.find((manager) => isOnPath(manager)) ??
    'npm'
  );
}

/**
 * Build the argv to run a script. `<pm> run <script>` is valid for all four
 * managers; only npm needs the `--` separator to forward extra args to the
 * script rather than to npm itself.
 */
export function buildRunCommand(
  manager: PackageManager,
  script: string,
  extraArgs: string[] = []
): { command: string; args: string[] } {
  const args = ['run', script];
  if (extraArgs.length > 0) {
    if (manager === 'npm') {
      args.push('--');
    }
    args.push(...extraArgs);
  }
  return { command: manager, args };
}

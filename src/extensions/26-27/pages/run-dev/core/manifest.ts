'use strict';

import * as fs from 'fs';
import * as path from 'path';

// ======================================
// RUN DEV — PACKAGE MANIFEST | MARK: MANIFEST
// ======================================
//
// Minimal, dependency-free reader for a project's package.json. Kept free of
// any `vscode` import so framework/package-manager detection stays unit-testable.

export interface PackageManifest {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  /** Corepack field, e.g. "pnpm@9.1.0". */
  packageManager?: string;
  [key: string]: unknown;
}

/** Parse the package.json in `dir`, or undefined when absent/invalid. */
export function readManifest(dir: string): PackageManifest | undefined {
  try {
    const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as PackageManifest) : undefined;
  } catch {
    return undefined;
  }
}

/** Union of dependency names across dependencies + devDependencies + peerDependencies. */
export function allDependencies(manifest: PackageManifest): Set<string> {
  const names = new Set<string>();
  for (const group of [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies]) {
    if (group) {
      for (const name of Object.keys(group)) {
        names.add(name);
      }
    }
  }
  return names;
}

/** Available npm-script names. */
export function scriptNames(manifest: PackageManifest): Set<string> {
  return new Set(Object.keys(manifest.scripts ?? {}));
}

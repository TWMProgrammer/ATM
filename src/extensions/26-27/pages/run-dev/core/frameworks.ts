'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { PackageManifest, allDependencies } from './manifest';

// ======================================
// RUN DEV — FRAMEWORK REGISTRY | MARK: FRAMEWORKS
// ======================================
//
// A data-driven registry that maps a project to how its dev server should be
// run and surfaced. Detection uses declared dependencies and marker config
// files; higher-priority entries win so specific frameworks beat the generic
// Vite/bundler entry they are built on. Add a framework by appending one row.

export interface Framework {
  readonly id: string;
  readonly label: string;
  /** Higher wins when several match (e.g. Next over generic Vite). */
  readonly priority: number;
  /** Script names to try, in order, before the generic fallback list. */
  readonly scripts: readonly string[];
  /** Whether it serves a web page ATM should open in a browser. */
  readonly opensBrowser: boolean;
  /** Port assumed only if none could be scraped from the output. */
  readonly defaultPort?: number;
  /** Dependency names that identify this framework. */
  readonly deps?: readonly string[];
  /** Marker config-file basenames that identify this framework. */
  readonly configFiles?: readonly string[];
}

// Ordered loosely by specificity; `priority` is what actually decides ties.
const REGISTRY: readonly Framework[] = [
  {
    id: 'next',
    label: 'Next.js',
    priority: 90,
    scripts: ['dev', 'start'],
    opensBrowser: true,
    defaultPort: 3000,
    deps: ['next'],
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs', 'next.config.cjs'],
  },
  {
    id: 'astro',
    label: 'Astro',
    priority: 90,
    scripts: ['dev', 'start'],
    opensBrowser: true,
    defaultPort: 4321,
    deps: ['astro'],
    configFiles: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js', 'astro.config.cjs'],
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    priority: 90,
    scripts: ['dev'],
    opensBrowser: true,
    defaultPort: 3000,
    deps: ['nuxt', 'nuxt3'],
    configFiles: ['nuxt.config.ts', 'nuxt.config.js'],
  },
  {
    id: 'sveltekit',
    label: 'SvelteKit',
    priority: 90,
    scripts: ['dev'],
    opensBrowser: true,
    defaultPort: 5173,
    deps: ['@sveltejs/kit'],
    configFiles: ['svelte.config.js'],
  },
  {
    id: 'lynx',
    label: 'Lynx',
    priority: 88,
    scripts: ['dev', 'start'],
    // Lynx apps preview in the LynxExplorer app (QR code in the terminal), not a
    // web browser — so we run + reveal the terminal but do not open a tab.
    opensBrowser: false,
    defaultPort: 3000,
    deps: ['@lynx-js/rspeedy', '@lynx-js/react', '@lynx-js/core'],
    configFiles: ['lynx.config.ts', 'lynx.config.js', 'rspeedy.config.ts', 'rspeedy.config.js'],
  },
  {
    id: 'expo',
    label: 'Expo',
    priority: 85, // above bare RN: Expo projects also depend on react-native
    scripts: ['start', 'dev'],
    opensBrowser: false,
    defaultPort: 8081,
    deps: ['expo'],
    configFiles: ['app.json', 'app.config.js', 'app.config.ts'],
  },
  {
    id: 'angular',
    label: 'Angular',
    priority: 80,
    scripts: ['start', 'dev'],
    opensBrowser: true,
    defaultPort: 4200,
    deps: ['@angular/core'],
    configFiles: ['angular.json'],
  },
  {
    id: 'react-native',
    label: 'React Native (Metro)',
    priority: 70,
    scripts: ['start'],
    opensBrowser: false,
    defaultPort: 8081,
    deps: ['react-native'],
    configFiles: ['metro.config.js', 'metro.config.ts'],
  },
  {
    id: 'vite',
    label: 'Vite',
    priority: 50, // generic bundler — specific frameworks above should win
    scripts: ['dev', 'start'],
    opensBrowser: true,
    defaultPort: 5173,
    deps: ['vite'],
    configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.mts'],
  },
];

/** Last-resort framework when nothing matches but a runnable script exists. */
export const GENERIC_FRAMEWORK: Framework = {
  id: 'generic',
  label: 'Dev Server',
  priority: 0,
  scripts: ['dev', 'start', 'serve', 'develop'],
  opensBrowser: true,
};

function matches(framework: Framework, dir: string, deps: Set<string>): boolean {
  if (framework.deps?.some((dep) => deps.has(dep))) {
    return true;
  }
  return framework.configFiles?.some((file) => fs.existsSync(path.join(dir, file))) ?? false;
}

/**
 * Identify the framework for a project. Returns the highest-priority match, or
 * the generic fallback so unknown-but-runnable projects still work.
 */
export function detectFramework(dir: string, manifest: PackageManifest): Framework {
  const deps = allDependencies(manifest);
  let best: Framework | undefined;
  for (const framework of REGISTRY) {
    if (matches(framework, dir, deps) && (!best || framework.priority > best.priority)) {
      best = framework;
    }
  }
  return best ?? GENERIC_FRAMEWORK;
}

/**
 * Choose the npm script to run: an explicit override first, then the
 * framework's preferred scripts, then a generic fallback — but only scripts
 * that actually exist (unless the user forced one).
 */
export function pickScript(
  manifest: PackageManifest,
  framework: Framework,
  override: string
): string | undefined {
  const available = manifest.scripts ?? {};
  if (override) {
    return override; // trust the user even if we can't see it (monorepo indirection, etc.)
  }
  const candidates = [...framework.scripts, ...GENERIC_FRAMEWORK.scripts];
  for (const name of candidates) {
    if (available[name]) {
      return name;
    }
  }
  return undefined;
}

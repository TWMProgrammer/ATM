'use strict';

import { stripAnsi } from './url-scanner';

// ======================================
// RUN DEV — RUNTIME ERROR SCANNER | MARK: ERROR-SCANNER
// ======================================
//
// Detects app-level errors (a broken component, a bad import, a runtime
// exception) from the dev server's own log lines — distinct from the process
// CRASHING (handled separately in the controller via process exit codes).
// Astro/Vite/Next deliberately keep running after an app error so HMR still
// works, so the only signal available is what they print to stdout/stderr.
//
// This is inherently heuristic: log formats differ per framework/version and
// aren't a stable contract. Patterns are intentionally broad-but-common
// rather than exhaustive — tune the lists below as real cases are found.

const ERROR_PATTERNS: readonly RegExp[] = [
  /\[ERROR\]/, // Astro's own leveled logger
  /\b(?:ReferenceError|TypeError|SyntaxError|RangeError)\b/, // uncaught JS errors (matches the SSR error Astro shows in its overlay)
  /internal server error/i, // Vite
  /pre-transform error/i, // Vite
  /failed to resolve import/i, // Vite
  /failed to compile/i, // webpack/CRA/Next
  /module not found/i, // webpack/Next
  /module build failed/i, // webpack
  /error ts\d+:/i, // tsc
  /unhandled(?: promise)? rejection/i,
  /uncaught exception/i,
  /^\s*error:\s/i, // generic CLI-reported error line
  /\[5\d{2}\]/, // request logger 5xx (server error). 4xx is NOT treated as an
  // error on purpose — a missing favicon ("[404] /favicon.ico") is routine.
];

const RECOVERY_PATTERNS: readonly RegExp[] = [
  // NOTE: a 2xx/3xx request status is deliberately NOT a recovery signal —
  // Astro serves its error-overlay page with HTTP 200, so a "[200]" would
  // wrongly clear a real error. Only an actual (re)compile success counts.
  /hmr update/i,
  /page reload/i,
  /compiled successfully/i,
  /webpack compiled/i,
  /no issues found/i,
  /✓\s*compiled/i, // Next.js
];

/** True when the line is a strong signal the app just broke. */
export function matchesError(line: string): boolean {
  return ERROR_PATTERNS.some((pattern) => pattern.test(line));
}

/** True when the line is a strong signal the app is healthy again. */
export function matchesRecovery(line: string): boolean {
  return RECOVERY_PATTERNS.some((pattern) => pattern.test(line));
}

export interface ErrorScanResult {
  error: boolean;
  recovery: boolean;
}

/**
 * Scan a raw output chunk (ANSI stripped internally), line by line in order.
 * A chunk can contain several log lines from one data event; whichever
 * pattern type matches LAST wins, since that reflects the current state
 * (e.g. an error line followed by a later successful recompile means "fixed").
 */
export function scanForRuntimeError(chunk: string): ErrorScanResult {
  const clean = stripAnsi(chunk);
  let last: 'error' | 'recovery' | undefined;
  for (const line of clean.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    if (matchesRecovery(line)) {
      last = 'recovery';
    } else if (matchesError(line)) {
      last = 'error';
    }
  }
  return { error: last === 'error', recovery: last === 'recovery' };
}

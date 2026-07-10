'use strict';

// ======================================
// RUN DEV — URL SCANNER | MARK: SCANNER
// ======================================
//
// Dev servers print the address they bound to (e.g. "Local: http://localhost:4321/").
// We scrape it from the process output so ATM opens the *exact* URL — even when
// the tool auto-incremented past a busy port — instead of guessing.

// CSI escape sequences (colours, cursor moves, line erases) dev servers emit.
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/g;
const LOCAL_HOSTS = '(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1?\\])';
const URL_RE = new RegExp(`https?://${LOCAL_HOSTS}(?::\\d+)?(?:/[^\\s'"\\)]*)?`, 'i');

/** Remove ANSI colour escape codes so the regexes match clean text. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/**
 * Find the local dev-server URL in accumulated output. Prefers a line labelled
 * "Local" (Vite/Astro/Next all use it) over any other local URL, and rewrites
 * an unbrowsable 0.0.0.0 host to localhost.
 */
export function scanForUrl(output: string): string | undefined {
  const clean = stripAnsi(output);

  let candidate: string | undefined;
  for (const line of clean.split(/\r?\n/)) {
    const match = URL_RE.exec(line);
    if (!match) {
      continue;
    }
    // Match the "Local" *label* as a whole word — \blocal\b does not match the
    // "local" inside "localhost", so a "Network:" line isn't mistaken for it.
    if (/\blocal\b/i.test(line)) {
      candidate = match[0];
      break; // a "Local:" line is the best possible match — stop here
    }
    candidate ??= match[0]; // remember the first local URL as a fallback
  }

  return candidate ? candidate.replace('0.0.0.0', 'localhost') : undefined;
}

/** Extract the port from a URL, defaulting to the protocol's implicit port. */
export function portFromUrl(url: string): number | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return Number(parsed.port);
    }
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return undefined;
  }
}

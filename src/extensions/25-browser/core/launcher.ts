import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

// ======================================
// ATM BROWSER — CHROMIUM LAUNCHER | MARK: LAUNCHER
// ======================================
//
// An extension cannot use VS Code's own integrated browser (it lives in
// Electron's main process as a WebContentsView). Instead we launch a real
// Chromium-family browser installed on the machine in headless mode with a
// DevTools (CDP) endpoint, and stream its frames into a webview. This works
// in any VS Code fork (Kiro, Antigravity, …) because it only needs the
// standard extension API plus Node.

export interface BrowserExecutable {
  /** Absolute path to the binary. */
  path: string;
  /** Human-readable product name, e.g. "Google Chrome". */
  name: string;
}

export interface LaunchedBrowser {
  executable: BrowserExecutable;
  /** CDP HTTP/WebSocket port bound on 127.0.0.1. */
  port: number;
  proc: ChildProcess;
  profileDir: string;
  /** True when running on a throwaway profile (another window owns the stable one). */
  ephemeral: boolean;
}

interface Candidate {
  name: string;
  linux?: string[];
  darwin?: string[];
  win32?: string[];
}

const CANDIDATES: Candidate[] = [
  {
    name: 'Google Chrome',
    linux: ['google-chrome', 'google-chrome-stable', '/opt/google/chrome/chrome'],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    win32: ['Google\\Chrome\\Application\\chrome.exe'],
  },
  {
    name: 'Microsoft Edge',
    linux: ['microsoft-edge', 'microsoft-edge-stable', '/opt/microsoft/msedge/msedge'],
    darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    win32: ['Microsoft\\Edge\\Application\\msedge.exe'],
  },
  {
    name: 'Chromium',
    linux: ['chromium', 'chromium-browser', '/snap/bin/chromium'],
    darwin: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    win32: ['Chromium\\Application\\chrome.exe'],
  },
  {
    name: 'Brave',
    linux: ['brave-browser', 'brave', '/opt/brave.com/brave/brave-browser'],
    darwin: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    win32: ['BraveSoftware\\Brave-Browser\\Application\\brave.exe'],
  },
  {
    name: 'Vivaldi',
    linux: ['vivaldi', 'vivaldi-stable', '/opt/vivaldi/vivaldi'],
    darwin: ['/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'],
    win32: ['Vivaldi\\Application\\vivaldi.exe'],
  },
];

function whichSync(cmd: string): string | undefined {
  if (path.isAbsolute(cmd)) {
    return fs.existsSync(cmd) ? cmd : undefined;
  }
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) {
      continue;
    }
    const full = path.join(dir, cmd);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return undefined;
}

function windowsRoots(): string[] {
  return [
    process.env['LOCALAPPDATA'],
    process.env['PROGRAMFILES'],
    process.env['PROGRAMFILES(X86)'],
  ].filter((root): root is string => typeof root === 'string' && root.length > 0);
}

/** Locate a Chromium-family browser: explicit setting first, then well-known installs. */
export function findBrowser(configuredPath?: string): BrowserExecutable | undefined {
  const configured = configuredPath?.trim();
  if (configured) {
    return fs.existsSync(configured)
      ? { path: configured, name: path.basename(configured) }
      : undefined;
  }
  for (const candidate of CANDIDATES) {
    if (process.platform === 'win32') {
      for (const suffix of candidate.win32 ?? []) {
        for (const root of windowsRoots()) {
          const full = path.join(root, suffix);
          if (fs.existsSync(full)) {
            return { path: full, name: candidate.name };
          }
        }
      }
    } else {
      const entries = (process.platform === 'darwin' ? candidate.darwin : candidate.linux) ?? [];
      for (const entry of entries) {
        const resolved = whichSync(entry);
        if (resolved) {
          return { path: resolved, name: candidate.name };
        }
      }
    }
  }
  return undefined;
}

// ======================================
// PROCESS LIFECYCLE | MARK: LIFECYCLE
// ======================================

const LAUNCH_TIMEOUT_MS = 15000;

function launchArgs(profileDir: string): string[] {
  return [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
    '--mute-audio',
    // Popups/`target=_blank` fire Page.windowOpen instead of spawning tabs,
    // so the panel can follow them in the same view.
    '--block-new-web-contents',
    '--window-size=1280,800',
    'about:blank',
  ];
}

function launchOnce(
  executable: BrowserExecutable,
  profileDir: string,
  ephemeral: boolean
): Promise<LaunchedBrowser> {
  fs.mkdirSync(profileDir, { recursive: true });
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  try {
    fs.unlinkSync(portFile);
  } catch {
    // No stale port file — fine.
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(executable.path, launchArgs(profileDir), {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderrTail = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    });

    let settled = false;
    const finish = (fn: () => void): void => {
      if (!settled) {
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        fn();
      }
    };

    // Chromium writes "<port>\n<browser ws path>" here once CDP is listening.
    const pollTimer = setInterval(() => {
      let content: string;
      try {
        content = fs.readFileSync(portFile, 'utf8');
      } catch {
        return;
      }
      const port = parseInt(content.split('\n')[0] ?? '', 10);
      if (Number.isFinite(port) && port > 0) {
        finish(() => resolve({ executable, port, proc, profileDir, ephemeral }));
      }
    }, 150);

    const timeoutTimer = setTimeout(() => {
      finish(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Already gone.
        }
        reject(
          new Error(
            `${executable.name} did not expose DevTools within ${LAUNCH_TIMEOUT_MS / 1000}s.\n${stderrTail}`
          )
        );
      });
    }, LAUNCH_TIMEOUT_MS);

    proc.once('exit', (code) => {
      finish(() =>
        reject(new Error(`${executable.name} exited (code ${code}) before DevTools was ready.\n${stderrTail}`))
      );
    });
    proc.once('error', (error) => finish(() => reject(error)));
  });
}

async function startBrowser(
  profileBase: string,
  configuredPath?: string
): Promise<LaunchedBrowser> {
  const executable = findBrowser(configuredPath);
  if (!executable) {
    throw new Error(
      'No Chromium-based browser found (Chrome, Edge, Brave, Chromium, Vivaldi). ' +
        'Install one or set "atm.browser.executablePath" in Settings.'
    );
  }
  const stableDir = path.join(profileBase, 'browser-profile');
  try {
    return await launchOnce(executable, stableDir, false);
  } catch {
    // The stable profile is likely locked by another IDE window — retry on a
    // throwaway profile so this window still gets a working browser.
    const ephemeralDir = path.join(profileBase, `browser-profile-${Date.now().toString(36)}`);
    return launchOnce(executable, ephemeralDir, true);
  }
}

// One browser process shared by every panel of this window; each panel holds a ref.
let shared: LaunchedBrowser | undefined;
let sharedPromise: Promise<LaunchedBrowser> | undefined;
let refs = 0;

export async function acquireBrowser(
  profileBase: string,
  configuredPath?: string
): Promise<LaunchedBrowser> {
  if (!sharedPromise) {
    sharedPromise = startBrowser(profileBase, configuredPath)
      .then((browser) => {
        shared = browser;
        browser.proc.once('exit', () => {
          if (shared === browser) {
            shared = undefined;
            sharedPromise = undefined;
            refs = 0;
            cleanupProfile(browser);
          }
        });
        return browser;
      })
      .catch((error) => {
        sharedPromise = undefined;
        throw error;
      });
  }
  const browser = await sharedPromise;
  refs++;
  return browser;
}

export function releaseBrowser(): void {
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    killBrowser();
  }
}

export function killBrowser(): void {
  const browser = shared;
  shared = undefined;
  sharedPromise = undefined;
  refs = 0;
  if (!browser) {
    return;
  }
  const killTimer = setTimeout(() => {
    try {
      browser.proc.kill('SIGKILL');
    } catch {
      // Already gone.
    }
  }, 2000);
  killTimer.unref();
  browser.proc.once('exit', () => {
    clearTimeout(killTimer);
    cleanupProfile(browser);
  });
  try {
    browser.proc.kill('SIGTERM');
  } catch {
    clearTimeout(killTimer);
  }
}

function cleanupProfile(browser: LaunchedBrowser): void {
  if (!browser.ephemeral) {
    return;
  }
  try {
    fs.rmSync(browser.profileDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

// ======================================
// DEVTOOLS HTTP ENDPOINTS | MARK: TARGETS
// ======================================

function devtoolsHttp(
  port: number,
  method: string,
  pathname: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: pathname, timeout: 5000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('DevTools HTTP request timed out')));
    req.on('error', reject);
    req.end();
  });
}

export interface PageTarget {
  targetId: string;
  wsUrl: string;
}

/** Open a new tab. Chromium ≥111 wants PUT for /json/new; older builds only accept GET. */
export async function createPageTarget(port: number, url: string): Promise<PageTarget> {
  const endpoint = '/json/new?' + encodeURI(url);
  let res = await devtoolsHttp(port, 'PUT', endpoint);
  if (res.status >= 400 || res.status === 0) {
    res = await devtoolsHttp(port, 'GET', endpoint);
  }
  if (res.status >= 400) {
    throw new Error(`DevTools refused to open a new tab (HTTP ${res.status})`);
  }
  const info = JSON.parse(res.body) as { id?: string; webSocketDebuggerUrl?: string };
  if (!info.id || !info.webSocketDebuggerUrl) {
    throw new Error('DevTools returned an unexpected /json/new payload');
  }
  return { targetId: info.id, wsUrl: info.webSocketDebuggerUrl };
}

export async function closePageTarget(port: number, targetId: string): Promise<void> {
  const endpoint = '/json/close/' + targetId;
  const res = await devtoolsHttp(port, 'GET', endpoint);
  if (res.status >= 400) {
    await devtoolsHttp(port, 'PUT', endpoint).catch(() => undefined);
  }
}

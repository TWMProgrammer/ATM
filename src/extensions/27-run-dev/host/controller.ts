'use strict';

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

import { detectFramework, pickScript, Framework } from '../core/frameworks';
import { detectPackageManager, buildRunCommand } from '../core/package-manager';
import { spawnDev, DevProcess } from '../core/process-tree';
import { scanForUrl, stripAnsi, portFromUrl } from '../core/url-scanner';
import { scanForRuntimeError } from '../core/error-scanner';
import { readManifest } from '../core/manifest';
import { RunDevConfig } from './config';
import { RunDevStatusBar } from './statusbar';
import { DevTerminal } from './dev-terminal';
import { resolveProject, ResolvedProject } from './project';

// ======================================
// RUN DEV — CONTROLLER | MARK: CONTROLLER
// ======================================
//
// Owns the dev-server lifecycle and state machine. Resolves the project,
// detects framework + package manager, spawns the dev script inside a
// pseudoterminal, scrapes the served URL to auto-open the browser, and handles
// stop / restart / failure.

type State = 'idle' | 'starting' | 'running' | 'failed';

const READY_TIMEOUT_MS = 20000;
const SCAN_BUFFER_CAP = 64 * 1024;
const RESTART_DEBOUNCE_MS = 300;
// Quiet period after an error/recovery signal before the pill is repainted, so
// a rapid error→recovery burst collapses into one final colour instead of
// flickering yellow→red→yellow.
const ERROR_SETTLE_MS = 350;
// After the server prints its URL we don't paint yet: the port is bound but the
// app hasn't compiled. We keep the spinner and VERIFY — trigger the first
// compile with a probe, watch for errors — then paint red/yellow once.
const MAX_VERIFY_MS = 8000; // hard cap so the spinner can't spin forever
const NO_PROBE_SETTLE_MS = 2000; // verify window when we don't probe (mobile targets / autoOpen off)
const POST_PROBE_FLUSH_MS = 300; // let the error log flush right after the probe response
const PROBE_TIMEOUT_MS = 7000;

interface Session {
  proc: DevProcess;
  pty: DevTerminal;
  terminal: vscode.Terminal;
  framework: Framework;
  projectDir: string;
  scanBuffer: string;
  urlFound: boolean;
  url?: string;
  stopping: boolean;
  /** True once we've committed to the running/error colour (verify finished). */
  finalized: boolean;
  /** An error was seen during the verify window. */
  sawError: boolean;
  /** App-level error currently painted (process itself is still alive). */
  errorActive: boolean;
  /** Latest desired error state awaiting the settle debounce. */
  pendingError?: boolean;
  settleTimer?: ReturnType<typeof setTimeout>;
  verifyTimer?: ReturnType<typeof setTimeout>;
  readyTimer?: ReturnType<typeof setTimeout>;
}

export class RunDevController {
  private state: State = 'idle';
  private session: Session | undefined;
  /** A finished/failed terminal kept visible so the user can read its output. */
  private deadTerminal: vscode.Terminal | undefined;
  private watchers: vscode.Disposable[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | undefined;
  private stopWaiters: Array<() => void> = [];

  private lastFileUri: vscode.Uri | undefined;
  private lastProjectDir: string | undefined;

  constructor(private readonly statusBar: RunDevStatusBar) {}

  // ------------------------------------
  // Commands | MARK: COMMANDS
  // ------------------------------------

  async start(fileUri?: vscode.Uri, reuseDir?: string): Promise<void> {
    if (this.state === 'starting') {
      this.reveal();
      return;
    }
    if (this.state === 'running') {
      // Smart re-trigger: surface what's already running instead of relaunching.
      this.reveal();
      this.openBrowser();
      return;
    }

    this.clearDeadTerminal();

    const project = await this.resolve(fileUri, reuseDir);
    if (!project) {
      return;
    }
    this.lastFileUri = fileUri;
    this.lastProjectDir = project.dir;

    const framework = detectFramework(project.dir, project.manifest);
    const script = pickScript(project.manifest, framework, RunDevConfig.script);
    if (!script) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t(
          'ATM Run Dev: no "dev"/"start" script found in {0}.',
          project.manifest.name ?? 'package.json'
        )
      );
      return;
    }
    const manager = detectPackageManager(project.dir, project.manifest, RunDevConfig.packageManager);
    const { command, args } = buildRunCommand(manager, script, RunDevConfig.extraArgs);

    this.state = 'starting';
    this.statusBar.showStarting(framework.label);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FORCE_COLOR: '1',
      BROWSER: 'none', // stop frameworks (CRA/etc.) opening their own tab; ATM opens one
      ...RunDevConfig.extraEnv,
    };
    const proc = spawnDev(command, args, { cwd: project.dir, env });
    const pty = new DevTerminal({
      onInput: (data) => proc.write(data),
      onInterrupt: () => proc.interrupt(),
      onClose: () => this.onTerminalClosed(session),
    });
    const terminal = vscode.window.createTerminal({
      name: `Run Dev — ${framework.label}`,
      pty,
      iconPath: new vscode.ThemeIcon('play'),
    });

    const session: Session = {
      proc,
      pty,
      terminal,
      framework,
      projectDir: project.dir,
      scanBuffer: '',
      urlFound: false,
      stopping: false,
      finalized: false,
      sawError: false,
      errorActive: false,
    };
    this.session = session;

    proc.onData((chunk) => {
      pty.write(chunk);
      this.handleOutput(session, chunk);
    });
    proc.onExit((code) => this.handleExit(session, code));

    pty.write(`\x1b[2m$ ${command} ${args.join(' ')}  (${manager})\x1b[0m\r\n`);
    // Stays silent by default (status bar spinner → yellow is the feedback);
    // only reveal-with-focus on failure (see handleExit) actually pulls the
    // user to the terminal.
    if (RunDevConfig.revealTerminalOnStart) {
      terminal.show(true); // reveal without stealing editor focus
    }

    session.readyTimer = setTimeout(() => this.onReadyTimeout(session), READY_TIMEOUT_MS);
  }

  async stop(silent = false): Promise<void> {
    const session = this.session;
    if (!session) {
      this.clearDeadTerminal();
      if (this.state !== 'idle') {
        this.state = 'idle';
        this.statusBar.showIdle();
      }
      if (!silent) {
        void vscode.window.showInformationMessage(
          vscode.l10n.t('ATM Run Dev: no dev server is running.')
        );
      }
      return;
    }
    return new Promise<void>((resolve) => {
      this.stopWaiters.push(resolve);
      if (!session.stopping) {
        session.stopping = true;
        this.disposeWatchers();
        if (session.readyTimer) {
          clearTimeout(session.readyTimer);
        }
        this.statusBar.showStarting(vscode.l10n.t('Stopping'));
        session.proc.kill();
      }
    });
  }

  async restart(): Promise<void> {
    const dir = this.session?.projectDir ?? this.lastProjectDir;
    const fileUri = this.lastFileUri;
    if (this.session) {
      await this.stop(true);
    } else {
      this.clearDeadTerminal();
    }
    await this.start(fileUri, dir);
  }

  openBrowser(): void {
    const url = this.session?.url;
    if (!url) {
      if (this.state === 'running') {
        void vscode.window.showInformationMessage(
          vscode.l10n.t('ATM Run Dev: the dev-server URL has not been detected yet.')
        );
      }
      return;
    }
    this.openUrl(url);
  }

  // ------------------------------------
  // Output → readiness | MARK: READINESS
  // ------------------------------------

  private handleOutput(session: Session, chunk: string): void {
    if (session !== this.session) {
      return;
    }
    if (!session.urlFound) {
      // Still starting: only scan for the served URL (spinner stays; benign
      // startup logs must not be mistaken for app errors yet).
      session.scanBuffer += stripAnsi(chunk);
      if (session.scanBuffer.length > SCAN_BUFFER_CAP) {
        session.scanBuffer = session.scanBuffer.slice(-SCAN_BUFFER_CAP);
      }
      const url = scanForUrl(session.scanBuffer);
      if (url) {
        this.onReady(session, url);
      }
      return;
    }

    const result = scanForRuntimeError(chunk);
    if (!session.finalized) {
      // Verify phase (port up, first compile in flight, spinner still showing).
      // The first error commits straight to red — no yellow flash beforehand.
      if (result.error) {
        session.sawError = true;
        this.finalizeReady(session);
      }
      return;
    }

    // Running: keep the pill in sync as errors come and go.
    if (result.error) {
      this.scheduleErrorPaint(session, true);
    } else if (result.recovery) {
      this.scheduleErrorPaint(session, false);
    }
  }

  // ------------------------------------
  // Runtime (app-level) error detection | MARK: RUNTIME-ERROR
  // ------------------------------------

  /** Record the latest desired error state and (re)arm the settle debounce. */
  private scheduleErrorPaint(session: Session, desiredError: boolean): void {
    if (session !== this.session) {
      return;
    }
    session.pendingError = desiredError;
    if (session.settleTimer) {
      clearTimeout(session.settleTimer);
    }
    session.settleTimer = setTimeout(() => this.applyErrorPaint(session), ERROR_SETTLE_MS);
  }

  /**
   * Paint the settled error state. Red stays until an actual recovery signal
   * (recompile/HMR success) arrives — never a timeout — so we don't clear a
   * still-broken app. Entering the error state also reveals the terminal so
   * the user can see what broke; a healthy state never opens it.
   */
  private applyErrorPaint(session: Session): void {
    session.settleTimer = undefined;
    if (session !== this.session || this.state !== 'running') {
      return;
    }
    const desired = session.pendingError ?? false;
    if (desired === session.errorActive) {
      return;
    }
    session.errorActive = desired;
    const port = session.url ? portFromUrl(session.url) : session.framework.defaultPort;
    if (desired) {
      this.statusBar.showRunningWithError(session.framework.label, port, session.url);
      session.terminal.show(true); // reveal the terminal (without stealing editor focus)
    } else {
      this.statusBar.showRunning(session.framework.label, port, session.url);
    }
  }

  private onReadyTimeout(session: Session): void {
    if (session !== this.session || session.urlFound) {
      return;
    }
    // No URL scraped — assume the framework's default port so the status bar and
    // (optional) browser still work.
    const url = session.framework.defaultPort
      ? `http://localhost:${session.framework.defaultPort}/`
      : undefined;
    this.onReady(session, url);
  }

  /**
   * The port is bound and we know the URL — but the app hasn't compiled yet.
   * Stay on the spinner and VERIFY: trigger the first compile (probe) and watch
   * for errors, so the pill commits once (red or yellow) with no flash.
   */
  private onReady(session: Session, url: string | undefined): void {
    if (session !== this.session || session.urlFound) {
      return;
    }
    session.urlFound = true;
    session.url = url;
    if (session.readyTimer) {
      clearTimeout(session.readyTimer);
      session.readyTimer = undefined;
    }
    // Keep spinning while we verify. Hard cap so it can never hang.
    session.verifyTimer = setTimeout(() => this.finalizeReady(session), MAX_VERIFY_MS);

    const willProbe =
      !!url && session.framework.opensBrowser && RunDevConfig.autoOpen && RunDevConfig.openBrowser !== 'none';
    if (willProbe && url) {
      // Force the first compile now (same request the browser would make), then
      // finalize just after — by which point any compile error has been logged.
      this.probeUrl(url, () => {
        setTimeout(() => this.finalizeReady(session), POST_PROBE_FLUSH_MS);
      });
    } else {
      // No probe (mobile target, or the user opted out of auto-open): a short
      // window watching the error scanner, then commit.
      setTimeout(() => this.finalizeReady(session), NO_PROBE_SETTLE_MS);
    }
  }

  /** Commit the settled colour once verification ends (or an error forces it early). */
  private finalizeReady(session: Session): void {
    if (session !== this.session || session.finalized) {
      return;
    }
    session.finalized = true;
    if (session.verifyTimer) {
      clearTimeout(session.verifyTimer);
      session.verifyTimer = undefined;
    }
    this.state = 'running';
    const { url } = session;
    const port = url ? portFromUrl(url) : session.framework.defaultPort;

    if (session.sawError) {
      session.errorActive = true;
      this.statusBar.showRunningWithError(session.framework.label, port, url);
      session.terminal.show(true); // reveal the terminal so the error is visible (no focus steal)
    } else {
      session.errorActive = false;
      this.statusBar.showRunning(session.framework.label, port, url);
    }

    if (url && session.framework.opensBrowser && RunDevConfig.autoOpen) {
      this.openUrl(url);
    }
    this.setupAutoRestart(session);
  }

  /** Fire one GET at the dev URL to trigger the first compile; result is ignored. */
  private probeUrl(url: string, done: () => void): void {
    let settled = false;
    const finish = (): void => {
      if (!settled) {
        settled = true;
        done();
      }
    };
    try {
      const client = url.startsWith('https:') ? https : http;
      // rejectUnauthorized:false so a self-signed HTTPS dev cert doesn't fail the probe.
      const options: https.RequestOptions = { timeout: PROBE_TIMEOUT_MS, rejectUnauthorized: false };
      const request = client.get(url, options, (res) => {
        res.resume(); // drain and discard the body
        res.on('end', finish);
        res.on('error', finish);
      });
      request.on('timeout', () => request.destroy());
      request.on('error', finish); // ECONNREFUSED etc. — let verification finalize anyway
    } catch {
      finish();
    }
  }

  // ------------------------------------
  // Exit / teardown | MARK: EXIT
  // ------------------------------------

  private handleExit(session: Session, code: number | null): void {
    if (session !== this.session) {
      return; // a stale process from a previous run
    }
    if (session.readyTimer) {
      clearTimeout(session.readyTimer);
    }
    if (session.settleTimer) {
      clearTimeout(session.settleTimer);
    }
    if (session.verifyTimer) {
      clearTimeout(session.verifyTimer);
    }
    this.disposeWatchers();
    this.session = undefined;

    if (session.stopping) {
      // We asked it to stop → silent, remove the terminal.
      session.terminal.dispose();
      this.state = 'idle';
      this.statusBar.showIdle();
      this.flushStopWaiters();
      return;
    }

    // Unexpected exit — keep the terminal so its error output stays readable.
    session.pty.writeExit(code);
    this.deadTerminal = session.terminal;
    const failed = code !== 0 && code !== null;
    if (failed) {
      this.state = 'failed';
      this.statusBar.showFailed();
      session.terminal.show(); // steal focus — an error is exactly when the user should be taken there
      this.notifyFailure(code);
    } else {
      this.state = 'idle';
      this.statusBar.showIdle();
    }
    this.flushStopWaiters();
  }

  private onTerminalClosed(session: Session): void {
    if (this.deadTerminal === session.terminal) {
      this.deadTerminal = undefined;
    }
    if (session === this.session && !session.stopping) {
      // User closed the terminal while it ran → treat as a stop.
      session.stopping = true;
      this.disposeWatchers();
      session.proc.kill();
    }
  }

  private notifyFailure(code: number | null): void {
    const showTerminal = vscode.l10n.t('Show Terminal');
    const restart = vscode.l10n.t('Restart');
    void vscode.window
      .showErrorMessage(
        vscode.l10n.t('ATM Run Dev: the dev server exited (code {0}).', code ?? '—'),
        showTerminal,
        restart
      )
      .then((choice) => {
        if (choice === showTerminal) {
          this.deadTerminal?.show();
        } else if (choice === restart) {
          void this.restart();
        }
      });
  }

  // ------------------------------------
  // Auto-restart on config change | MARK: AUTORESTART
  // ------------------------------------

  private setupAutoRestart(session: Session): void {
    if (!RunDevConfig.autoRestartOnConfigChange) {
      return;
    }
    this.disposeWatchers();
    for (const glob of RunDevConfig.configWatchGlobs) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(session.projectDir), glob)
      );
      const trigger = (): void => this.scheduleAutoRestart();
      this.watchers.push(
        watcher,
        watcher.onDidChange(trigger),
        watcher.onDidCreate(trigger),
        watcher.onDidDelete(trigger)
      );
    }
  }

  private scheduleAutoRestart(): void {
    if (this.state !== 'running') {
      return;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }
    this.restartTimer = setTimeout(() => {
      this.session?.pty.write('\x1b[2m[ATM Run Dev] config changed — restarting…\x1b[0m\r\n');
      void this.restart();
    }, RESTART_DEBOUNCE_MS);
  }

  // ------------------------------------
  // Helpers | MARK: HELPERS
  // ------------------------------------

  private async resolve(
    fileUri: vscode.Uri | undefined,
    reuseDir: string | undefined
  ): Promise<ResolvedProject | undefined> {
    if (reuseDir) {
      const manifest = readManifest(reuseDir);
      if (manifest) {
        return { dir: reuseDir, manifest };
      }
    }
    return resolveProject(fileUri);
  }

  private openUrl(url: string): void {
    const target = RunDevConfig.openBrowser;
    if (target === 'none') {
      return;
    }
    if (target === 'simpleBrowser') {
      void Promise.resolve(vscode.commands.executeCommand('simpleBrowser.show', url)).then(
        undefined,
        () => vscode.env.openExternal(vscode.Uri.parse(url))
      );
      return;
    }
    void vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private reveal(): void {
    (this.session?.terminal ?? this.deadTerminal)?.show();
  }

  private disposeWatchers(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }
    for (const disposable of this.watchers) {
      disposable.dispose();
    }
    this.watchers = [];
  }

  private clearDeadTerminal(): void {
    this.deadTerminal?.dispose();
    this.deadTerminal = undefined;
  }

  private flushStopWaiters(): void {
    const waiters = this.stopWaiters;
    this.stopWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  dispose(): void {
    this.disposeWatchers();
    const session = this.session;
    if (session) {
      session.stopping = true;
      if (session.readyTimer) {
        clearTimeout(session.readyTimer);
      }
      if (session.settleTimer) {
        clearTimeout(session.settleTimer);
      }
      if (session.verifyTimer) {
        clearTimeout(session.verifyTimer);
      }
      session.proc.kill();
      session.terminal.dispose();
      this.session = undefined;
    }
    this.clearDeadTerminal();
    this.flushStopWaiters();
    this.state = 'idle';
  }
}

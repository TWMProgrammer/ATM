'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { LiveServer, ServerOptions } from '../core/server';
import { getLanAddress, isLoopbackHost } from '../core/network';
import { GoLiveConfig, OpenTarget } from './config';
import { GoLiveStatusBar } from './statusbar';
import { ReloadWatcher } from './watcher';

// ======================================
// GO LIVE — CONTROLLER | MARK: CONTROLLER
// ======================================
//
// Orchestrates the whole feature: resolves which workspace/root to serve,
// starts the server (auto-incrementing past a busy port), wires the file
// watcher to live reload, opens the page, and keeps the status bar in sync.

type State = 'idle' | 'starting' | 'live' | 'stopping';

const OPENABLE_EXT = new Set(['.html', '.htm', '.xhtml', '.svg']);
const MAX_PORT_ATTEMPTS = 20;

export class GoLiveController {
  private state: State = 'idle';
  private server: LiveServer | undefined;
  private watcher: ReloadWatcher | undefined;
  private port = 0;
  private host = '127.0.0.1';
  private protocol: 'http' | 'https' = 'http';
  private rootDir = '';
  private workspacePath = '';

  constructor(private readonly statusBar: GoLiveStatusBar) {}

  // ------------------------------------
  // Commands | MARK: COMMANDS
  // ------------------------------------

  async start(fileUri?: vscode.Uri): Promise<void> {
    if (this.state === 'starting' || this.state === 'stopping') {
      return;
    }

    const workspacePath = await this.resolveWorkspace(fileUri);
    if (!workspacePath) {
      return;
    }

    // Already live: just open the requested page rather than restarting.
    if (this.state === 'live' && this.server) {
      this.openInBrowser(this.relativePathFor(fileUri));
      return;
    }

    this.state = 'starting';
    this.statusBar.showWorking(vscode.l10n.t('Starting…'));

    try {
      this.workspacePath = workspacePath;
      this.rootDir = this.resolveRoot(workspacePath);
      this.host = GoLiveConfig.host;

      const https = GoLiveConfig.readHttps();
      this.protocol = https ? 'https' : 'http';

      const baseOptions: Omit<ServerOptions, 'port'> = {
        root: this.rootDir,
        host: this.host,
        https,
        cors: GoLiveConfig.cors,
        headers: GoLiveConfig.headers,
        mounts: GoLiveConfig.buildMounts(workspacePath),
        spaFallback: GoLiveConfig.spaFallback || undefined,
      };

      const { server, port } = await this.listenWithRetry(baseOptions, GoLiveConfig.port);
      this.server = server;
      this.port = port;

      this.watcher = new ReloadWatcher(this.rootDir, workspacePath, {
        reload: () => this.server?.reload(),
        reloadCss: () => this.server?.reloadCss(),
      });

      this.state = 'live';
      this.statusBar.showLive(port, this.lanUrl());
      this.openInBrowser(this.relativePathFor(fileUri));
    } catch (error) {
      this.state = 'idle';
      this.statusBar.showReady();
      await this.cleanup();
      const detail = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(
        vscode.l10n.t('Go Live: could not start the server. {0}', detail)
      );
    }
  }

  async stop(): Promise<void> {
    if (this.state !== 'live') {
      void vscode.window.showInformationMessage(vscode.l10n.t('Go Live: the server is not running.'));
      return;
    }
    this.state = 'stopping';
    this.statusBar.showWorking(vscode.l10n.t('Stopping…'));
    await this.cleanup();
    this.state = 'idle';
    this.port = 0;
    this.statusBar.showReady();
  }

  async changeWorkspace(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length < 2) {
      return;
    }
    const picked = await vscode.window.showQuickPick(
      folders.map((folder) => folder.name),
      { placeHolder: vscode.l10n.t('Choose the workspace folder for Go Live'), ignoreFocusOut: true }
    );
    if (!picked) {
      return;
    }
    await GoLiveConfig.setMultiRootWorkspaceName(picked);
    if (this.state === 'live') {
      await this.stop();
    }
    void vscode.window.showInformationMessage(
      vscode.l10n.t("Go Live: '{0}' is now the server root.", picked)
    );
  }

  // ------------------------------------
  // Server startup | MARK: STARTUP
  // ------------------------------------

  /** Try successive ports until one binds, so a busy 5500 doesn't block Go Live. */
  private async listenWithRetry(
    baseOptions: Omit<ServerOptions, 'port'>,
    startPort: number
  ): Promise<{ server: LiveServer; port: number }> {
    let attemptPort = startPort;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
      const server = new LiveServer({ ...baseOptions, port: attemptPort });
      try {
        const port = await server.start();
        if (port !== startPort) {
          void vscode.window.showInformationMessage(
            vscode.l10n.t('Go Live: port {0} was busy, serving on {1} instead.', startPort, port)
          );
        }
        return { server, port };
      } catch (error) {
        await server.stop();
        lastError = error;
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          attemptPort++;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`No free port found between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS}.`);
  }

  private async cleanup(): Promise<void> {
    this.watcher?.dispose();
    this.watcher = undefined;
    if (this.server) {
      await this.server.stop();
      this.server = undefined;
    }
  }

  // ------------------------------------
  // Workspace / path resolution | MARK: PATHS
  // ------------------------------------

  private async resolveWorkspace(fileUri?: vscode.Uri): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      void vscode.window.showErrorMessage(
        vscode.l10n.t('Go Live: open a folder or workspace first (File → Open Folder).')
      );
      return undefined;
    }
    if (folders.length === 1) {
      return folders[0].uri.fsPath;
    }
    // Multi-root: prefer the folder containing the clicked file.
    if (fileUri) {
      const owner = folders.find((folder) => fileUri.fsPath.startsWith(folder.uri.fsPath));
      if (owner) {
        return owner.uri.fsPath;
      }
    }
    // Then a previously chosen folder, if still valid.
    const remembered = GoLiveConfig.multiRootWorkspaceName;
    if (remembered) {
      const match = folders.find((folder) => folder.name === remembered);
      if (match) {
        return match.uri.fsPath;
      }
    }
    // Otherwise ask.
    const picked = await vscode.window.showQuickPick(
      folders.map((folder) => folder.name),
      { placeHolder: vscode.l10n.t('Choose the workspace folder for Go Live'), ignoreFocusOut: true }
    );
    if (!picked) {
      return undefined;
    }
    await GoLiveConfig.setMultiRootWorkspaceName(picked);
    return folders.find((folder) => folder.name === picked)?.uri.fsPath;
  }

  /** Apply the configured root sub-folder, falling back to the workspace root when it's missing. */
  private resolveRoot(workspacePath: string): string {
    const configured = GoLiveConfig.root;
    if (!configured) {
      return workspacePath;
    }
    const candidate = path.join(workspacePath, configured);
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Missing/invalid root — warn and serve the workspace root instead.
    }
    void vscode.window.showWarningMessage(
      vscode.l10n.t('Go Live: "atm.goLive.root" is invalid; serving the workspace root instead.')
    );
    return workspacePath;
  }

  /** Root-relative URL path for an openable (html/svg) file, or "" for the site root. */
  private relativePathFor(fileUri?: vscode.Uri): string {
    const target = fileUri?.fsPath ?? vscode.window.activeTextEditor?.document.fileName;
    if (!target || !OPENABLE_EXT.has(path.extname(target).toLowerCase())) {
      return '';
    }
    const rel = path.relative(this.rootDir, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return '';
    }
    return rel.split(path.sep).join('/');
  }

  // ------------------------------------
  // Browser | MARK: BROWSER
  // ------------------------------------

  private lanUrl(): string | undefined {
    const displayHost = isLoopbackHost(this.host) ? getLanAddress() : this.host;
    return displayHost ? `${this.protocol}://${displayHost}:${this.port}/` : undefined;
  }

  private openInBrowser(relativePath: string): void {
    const target: OpenTarget = GoLiveConfig.openIn;
    if (target === 'none') {
      return;
    }
    const url = `${this.protocol}://${this.host}:${this.port}/${relativePath}`;
    if (target === 'simpleBrowser') {
      void Promise.resolve(vscode.commands.executeCommand('simpleBrowser.show', url)).then(
        undefined,
        () => vscode.env.openExternal(vscode.Uri.parse(url))
      );
      return;
    }
    void vscode.env.openExternal(vscode.Uri.parse(url));
  }

  /** Silent teardown for extension shutdown — no notifications, no status-bar churn. */
  async dispose(): Promise<void> {
    this.state = 'idle';
    await this.cleanup();
  }
}

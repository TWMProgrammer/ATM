'use strict';

import * as vscode from 'vscode';
import { PackageManager } from '../core/package-manager';

// ======================================
// RUN DEV — CONFIGURATION | MARK: CONFIG
// ======================================
//
// Typed accessor over the `atm.runDev.*` settings namespace.

export type OpenTarget = 'external' | 'simpleBrowser' | 'none';
export type ManagerSetting = PackageManager | 'auto';

export class RunDevConfig {
  private static get cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('atm.runDev');
  }

  private static get<T>(key: string, fallback: T): T {
    const value = RunDevConfig.cfg.get<T>(key);
    return value === undefined ? fallback : value;
  }

  static get packageManager(): ManagerSetting {
    return RunDevConfig.get<ManagerSetting>('packageManager', 'auto');
  }

  /** Explicit script override ("" = auto-detect dev/start). */
  static get script(): string {
    return RunDevConfig.get<string>('script', '').trim();
  }

  static get openBrowser(): OpenTarget {
    return RunDevConfig.get<OpenTarget>('openBrowser', 'external');
  }

  static get autoOpen(): boolean {
    return RunDevConfig.get<boolean>('autoOpen', true);
  }

  static get autoRestartOnConfigChange(): boolean {
    return RunDevConfig.get<boolean>('autoRestartOnConfigChange', false);
  }

  static get configWatchGlobs(): string[] {
    return RunDevConfig.get<string[]>('configWatchGlobs', [
      '**/*.config.{js,ts,mjs,cjs,mts}',
      '.env',
      '.env.*',
    ]);
  }

  static get extraArgs(): string[] {
    return RunDevConfig.get<string[]>('args', []);
  }

  static get extraEnv(): Record<string, string> {
    return RunDevConfig.get<Record<string, string>>('env', {});
  }

  static get revealTerminalOnStart(): boolean {
    return RunDevConfig.get<boolean>('revealTerminalOnStart', true);
  }

  static get showOnStatusbar(): boolean {
    return RunDevConfig.get<boolean>('showOnStatusbar', true);
  }
}

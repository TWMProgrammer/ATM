'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HttpsOptions, MountRule } from '../core/server';

// ======================================
// GO LIVE — CONFIGURATION | MARK: CONFIG
// ======================================
//
// Thin, typed accessor over the `atm.goLive.*` settings namespace. Mirrors the
// role of Live Server's old `Config` class but with ATM-style naming and only
// the settings this modern rewrite actually honours.

export type OpenTarget = 'external' | 'simpleBrowser' | 'none';

interface RawHttps {
	enable: boolean;
	cert: string;
	key: string;
	passphrase: string;
}

export class GoLiveConfig {
	private static get cfg(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('atm.goLive');
	}

	private static get<T>(key: string, fallback: T): T {
		const value = GoLiveConfig.cfg.get<T>(key);
		return value === undefined ? fallback : value;
	}

	static get port(): number {
		return GoLiveConfig.get<number>('port', 3222);
	}

	static setPort(port: number): Thenable<void> {
		return GoLiveConfig.cfg.update('port', port, vscode.ConfigurationTarget.Workspace);
	}

	static get host(): string {
		return GoLiveConfig.get<string>('host', '127.0.0.1') || '127.0.0.1';
	}

	/** Root sub-folder relative to the workspace ("" = workspace root). */
	static get root(): string {
		return GoLiveConfig.get<string>('root', '');
	}

	static get openIn(): OpenTarget {
		return GoLiveConfig.get<OpenTarget>('openIn', 'external');
	}

	static get ignoreFiles(): string[] {
		return GoLiveConfig.get<string[]>('ignoreFiles', []);
	}

	/** Debounce window (ms) before a file change triggers a reload. */
	static get wait(): number {
		const wait = GoLiveConfig.get<number>('wait', 100);
		return Number.isFinite(wait) && wait >= 0 ? wait : 100;
	}

	/** When true, CSS edits trigger a full reload instead of a hot swap. */
	static get fullReload(): boolean {
		return GoLiveConfig.get<boolean>('fullReload', false);
	}

	static get cors(): boolean {
		return GoLiveConfig.get<boolean>('cors', false);
	}

	static get headers(): Record<string, string> {
		return GoLiveConfig.get<Record<string, string>>('headers', {});
	}

	/** Root-relative file served on navigation 404s (single-page-app fallback). */
	static get spaFallback(): string {
		return GoLiveConfig.get<string>('spaFile', '').trim();
	}

	static get multiRootWorkspaceName(): string {
		return GoLiveConfig.get<string>('multiRootWorkspaceName', '');
	}

	static setMultiRootWorkspaceName(name: string | undefined): Thenable<void> {
		return GoLiveConfig.cfg.update(
			'multiRootWorkspaceName',
			name,
			vscode.ConfigurationTarget.Workspace
		);
	}

	/**
	 * Read the HTTPS key/cert from disk when enabled. Returns null when HTTPS is
	 * off; throws a readable error when enabled but the files are missing.
	 */
	static readHttps(): HttpsOptions | null {
		const raw = GoLiveConfig.get<RawHttps>('https', {
			enable: false,
			cert: '',
			key: '',
			passphrase: '',
		});
		if (!raw || !raw.enable) {
			return null;
		}
		if (!raw.cert || !raw.key) {
			throw new Error('HTTPS is enabled but "atm.goLive.https.cert" or ".key" is not set.');
		}
		return {
			cert: fs.readFileSync(raw.cert, 'utf8'),
			key: fs.readFileSync(raw.key, 'utf8'),
			passphrase: raw.passphrase || undefined,
		};
	}

	/** Resolve `[route, dir]` mount rules against the active workspace folder. */
	static buildMounts(workspacePath: string): MountRule[] {
		const raw = GoLiveConfig.get<string[][]>('mount', []);
		const mounts: MountRule[] = [];
		for (const rule of raw) {
			if (!Array.isArray(rule) || rule.length !== 2 || !rule[0] || !rule[1]) {
				continue;
			}
			const route = rule[0].startsWith('/') ? rule[0] : '/' + rule[0];
			mounts.push({
				route: route.replace(/\/+$/, '') || '/',
				dir: path.resolve(workspacePath, rule[1]),
			});
		}
		return mounts;
	}
}

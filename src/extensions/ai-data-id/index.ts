import * as vscode from 'vscode';
import { ProcessFinder } from './core/process-finder';
import { QuotaManager } from './core/quota-manager';
import { QuotaSnapshot } from './core/types';
import { buildTooltip, computeEngineeredCredits, resolvePlanTier } from './ui/tooltip-builder';

// ── Constants ────────────────────────────────────────────────────────

/** How often (ms) to poll for updated quota data (normal). */
const POLLING_INTERVAL_NORMAL_MS = 60_000; // 1 minute
/** How often (ms) to poll when quota is <= 20% (danger zone). */
const POLLING_INTERVAL_FAST_MS = 30_000; // 30 seconds

/** Delay (ms) before the first fetch to avoid blocking IDE startup. */
const INITIAL_DELAY_MS = 3_000;

// ── Status bar icons ─────────────────────────────────────────────────

const ICON_DEFAULT = '$(sparkle-filled)';
const ICON_ERROR = '$(error)';
const ICON_WARNING = '$(warning)';
const ICON_REFRESH = '$(sync~spin)';

/**
 * Activates the AI Data status bar extension.
 * Only runs when the host IDE is Antigravity.
 *
 * @param context - VS Code extension context for lifecycle management.
 */
export function activateDataId(context: vscode.ExtensionContext): void {
	const appName = vscode.env.appName || '';
	const isAntigravity = appName.toLowerCase().includes('antigravity');

	vscode.commands.executeCommand('setContext', 'atm.isAntigravity', isAntigravity);

	if (!isAntigravity) { return; }

	// ── Status bar item ──────────────────────────────────────────────

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = `${ICON_DEFAULT} AI Data`;
	statusBarItem.command = 'atm.dataId.showConsumption';
	statusBarItem.tooltip = new vscode.MarkdownString('*Loading AI usage data...*');
	statusBarItem.show();

	// ── Core services ────────────────────────────────────────────────

	const processFinder = new ProcessFinder();
	const quotaManager = new QuotaManager();

	// ── Fetch state ──────────────────────────────────────────────────

	let isFetching = false;
	let queuedForceRefresh = false;
	let lastSnapshotHash = '';
	let lastSnapshot: QuotaSnapshot | null = null;
	let fetchTimer: NodeJS.Timeout | null = null;
	let lastReportedPercentage = 100; // Stores the last engineered percentage

	/** Builds a hash of the snapshot to detect meaningful changes. */
	function computeSnapshotHash(snapshot: QuotaSnapshot): string {
		return snapshot.models
			.map(m => `${m.modelId}:${m.remainingPercentage}:${m.isExhausted}:${m.resetTime.getTime()}`)
			.join('|');
	}

	/** Selects the appropriate status bar icon based on the engineered percentage. */
	function getStatusBarIcon(minRemaining: number): string {
		// 20% is considered a danger zone (quota might be exhausted shortly).
		if (minRemaining <= 20) { return ICON_ERROR; }
		return ICON_DEFAULT;
	}

	/**
	 * Fetches quota data and updates the status bar item.
	 * Handles connection initialization, hash-based deduplication,
	 * and schedules the next poll.
	 */
	async function fetchAndUpdateQuota(forceRefresh = false): Promise<boolean> {
		if (isFetching) {
			if (forceRefresh) {
				queuedForceRefresh = true;
			}
			return false;
		}
		isFetching = true;

		try {
			const connectionInfo = quotaManager.getConnectionInfo();

			// If not connected yet, detect the Antigravity process
			if (!connectionInfo) {
				const processInfo = await processFinder.detectProcessInfo();
				if (processInfo) {
					quotaManager.init(processInfo.connectPort, processInfo.csrfToken);
					statusBarItem.text = `${ICON_DEFAULT} AI Data`;
					statusBarItem.color = undefined;
				} else {
					statusBarItem.text = `${ICON_ERROR} AI Data`;
					statusBarItem.color = new vscode.ThemeColor('errorForeground');
					statusBarItem.tooltip = new vscode.MarkdownString(
						'Could not connect to the local Antigravity AI process.'
					);
					return false;
				}
			}

			// Fetch quota data via local HTTPS
			const snapshot = await quotaManager.fetchQuota();
			if (snapshot) {
				const currentHash = computeSnapshotHash(snapshot);

				if (currentHash !== lastSnapshotHash || forceRefresh) {
					lastSnapshot = snapshot;
					statusBarItem.tooltip = buildTooltip(snapshot);
					lastSnapshotHash = currentHash;
				}

				const measuredModels = snapshot.models.filter(m => m.remainingPercentage !== undefined);
				if (measuredModels.length === 0) {
					statusBarItem.text = `${ICON_DEFAULT} AI Data`;
					statusBarItem.color = undefined;
				} else {
					// Use the new, robust global engineered algorithm!
					const tier = resolvePlanTier(snapshot.teamsTier, snapshot.planName);
					const engineered = computeEngineeredCredits(snapshot.models, tier);
					
					if (engineered.type === 'unlimited') {
						statusBarItem.text = `✨ AI ∞%`;
						statusBarItem.color = undefined;
						lastReportedPercentage = 100;
					} else {
						const globalPct = Math.round(engineered.percentage);
						lastReportedPercentage = globalPct;
						statusBarItem.text = `${getStatusBarIcon(globalPct)} AI ${globalPct}%`;
						statusBarItem.color = globalPct <= 20 ? new vscode.ThemeColor('errorForeground') : undefined;
					}
				}
			}

			return true;
		} catch (e) {
			console.error('[ai-data-id] Error fetching quota:', e);
			quotaManager.reset();
			statusBarItem.text = `${ICON_WARNING} AI Data`;
			statusBarItem.color = new vscode.ThemeColor('errorForeground');
			statusBarItem.tooltip = new vscode.MarkdownString(
				'Partial connection error. Will retry automatically...'
			);
			return false;
		} finally {
			isFetching = false;
			if (fetchTimer) { clearTimeout(fetchTimer); }

			if (queuedForceRefresh) {
				queuedForceRefresh = false;
				fetchTimer = setTimeout(() => {
					void fetchAndUpdateQuota(true);
				}, 0);
			} else {
				// Adaptive Polling:
				// Only schedule if the window is focused (performance optimization).
				if (vscode.window.state.focused) {
					const nextInterval = lastReportedPercentage <= 20 ? POLLING_INTERVAL_FAST_MS : POLLING_INTERVAL_NORMAL_MS;
					fetchTimer = setTimeout(() => {
						void fetchAndUpdateQuota();
					}, nextInterval);
				}
			}
		}
	}

	/** Triggers an immediate refresh with visual feedback. */
	const forceRefresh = async (): Promise<void> => {
		statusBarItem.text = `${ICON_REFRESH} AI Data`;
		if (lastSnapshot && !isFetching) {
			statusBarItem.tooltip = buildTooltip(lastSnapshot, true);
		}
		await fetchAndUpdateQuota(true);
	};

	// ── Commands ─────────────────────────────────────────────────────

	const refreshCmd = vscode.commands.registerCommand('atm.dataId.refreshConsumption', forceRefresh);
	const showCmd = vscode.commands.registerCommand('atm.dataId.showConsumption', forceRefresh);

	// ── Event Listeners (Impact & Focus) ─────────────────────────────

	// 1. Smart Wake-up (Focus)
	const windowStateSub = vscode.window.onDidChangeWindowState((state) => {
		if (state.focused) {
			// Update immediately when returning to VS Code
			void fetchAndUpdateQuota();
		} else {
			// Pause polling to save resources while in background
			if (fetchTimer) {
				clearTimeout(fetchTimer);
				fetchTimer = null;
			}
		}
	});

	// 2. Impact Detector (Large code insertions / AI activity)
	let debounceTimer: NodeJS.Timeout | null = null;
	const textDocSub = vscode.workspace.onDidChangeTextDocument((e) => {
		if (e.document.uri.scheme !== 'file') { return; }

		const hasLargeInsert = e.contentChanges.some(change => {
			const text = change.text;
			if (!text) { return false; }
			const lineCount = (text.match(/\n/g) || []).length;
			return lineCount >= 3;
		});

		if (hasLargeInsert) {
			if (debounceTimer) { clearTimeout(debounceTimer); }
			// 5s debounce to avoid spamming the local server
			debounceTimer = setTimeout(() => {
				void fetchAndUpdateQuota();
			}, 5000);
		}
	});

	// ── Bootstrap ────────────────────────────────────────────────────

	fetchTimer = setTimeout(() => fetchAndUpdateQuota(), INITIAL_DELAY_MS);

	// ── Cleanup ──────────────────────────────────────────────────────

	context.subscriptions.push(
		statusBarItem,
		refreshCmd,
		showCmd,
		windowStateSub,
		textDocSub,
		{
			dispose: () => {
				if (fetchTimer) { clearTimeout(fetchTimer); }
				if (debounceTimer) { clearTimeout(debounceTimer); }
				quotaManager.dispose();
			}
		}
	);
}

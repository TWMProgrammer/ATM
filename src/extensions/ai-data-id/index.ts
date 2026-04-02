import * as vscode from 'vscode';
import { ProcessFinder } from './core/process-finder';
import { QuotaManager } from './core/quota-manager';
import { QuotaSnapshot } from './core/types';
import { buildTooltip, computeEngineeredCredits, resolvePlanTier } from './ui/tooltip-builder';

// ── Constants ────────────────────────────────────────────────────────

/** How often (ms) to poll for updated quota data. */
const POLLING_INTERVAL_MS = 120_000; // 2 minutes

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

	/** Builds a hash of the snapshot to detect meaningful changes. */
	function computeSnapshotHash(snapshot: QuotaSnapshot): string {
		return snapshot.models
			.map(m => `${m.modelId}:${m.remainingPercentage}:${m.isExhausted}:${m.timeUntilResetFormatted}`)
			.join('|');
	}

	/** Selects the appropriate status bar icon based on the lowest quota %. */
	function getStatusBarIcon(_minRemaining: number): string {
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
				} else {
					statusBarItem.text = `${ICON_ERROR} AI Data`;
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
				} else {
					// Use the new, robust global engineered algorithm!
					const tier = resolvePlanTier(snapshot.teamsTier, snapshot.planName);
					const engineered = computeEngineeredCredits(snapshot.models, tier);
					
					if (engineered.type === 'unlimited') {
						statusBarItem.text = `✨ AI ∞%`;
					} else {
						const globalPct = Math.round(engineered.percentage);
						statusBarItem.text = `${getStatusBarIcon(globalPct)} AI ${globalPct}%`;
					}
				}
			}

			return true;
		} catch (e) {
			console.error('[ai-data-id] Error fetching quota:', e);
			quotaManager.reset();
			statusBarItem.text = `${ICON_WARNING} AI Data`;
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
				fetchTimer = setTimeout(() => {
					void fetchAndUpdateQuota();
				}, POLLING_INTERVAL_MS);
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

	// ── Bootstrap ────────────────────────────────────────────────────

	fetchTimer = setTimeout(() => fetchAndUpdateQuota(), INITIAL_DELAY_MS);

	// ── Cleanup ──────────────────────────────────────────────────────

	context.subscriptions.push(
		statusBarItem,
		refreshCmd,
		showCmd,
		{
			dispose: () => {
				if (fetchTimer) { clearTimeout(fetchTimer); }
				quotaManager.dispose();
			}
		}
	);
}

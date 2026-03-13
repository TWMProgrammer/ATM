import * as vscode from 'vscode';
import { ProcessFinder } from './core/process-finder';
import { QuotaManager } from './core/quota-manager';
import { QuotaSnapshot } from './core/types';
import { buildTooltip } from './ui/tooltip-builder';

const POLLING_INTERVAL_MS = 120_000; // 2 minutes
const INITIAL_DELAY_MS = 3_000;

/**
 * Activates the AI Data status bar extension.
 * Only runs when the host IDE is Antigravity.
 */
export function activateDataId(context: vscode.ExtensionContext): void {
	const appName = vscode.env.appName || '';
	const isAntigravity = appName.toLowerCase().includes('antigravity');

	vscode.commands.executeCommand('setContext', 'atm.isAntigravity', isAntigravity);

	if (!isAntigravity) { return; }

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(sparkle-filled) AI Data';
	statusBarItem.command = 'atm.dataId.showConsumption';
	statusBarItem.tooltip = new vscode.MarkdownString('*Loading AI usage data...*');
	statusBarItem.show();

	const processFinder = new ProcessFinder();
	const quotaManager = new QuotaManager();
	let isFetching = false;
	let queuedForceRefresh = false;
	let lastSnapshotHash = '';
	let lastSnapshot: QuotaSnapshot | null = null;
	let fetchTimer: NodeJS.Timeout | null = null;

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
				const processInfo = await processFinder.detectProcessInfo(2);
				if (processInfo) {
					quotaManager.init(processInfo.connectPort, processInfo.csrfToken);
					statusBarItem.text = '$(sparkle-filled) AI Data';
				} else {
					statusBarItem.text = '$(error) AI Data';
					statusBarItem.tooltip = new vscode.MarkdownString(
						'Could not connect to the local Antigravity AI process.'
					);
					return false;
				}
			}

			// Fetch quota data via local HTTPS
			const snapshot = await quotaManager.fetchQuota();
			if (snapshot) {
				const currentHash = snapshot.models
					.map(m => `${m.modelId}:${m.remainingPercentage}:${m.isExhausted}:${m.timeUntilResetFormatted}`)
					.join('|');

				if (currentHash !== lastSnapshotHash || forceRefresh) {
					lastSnapshot = snapshot;
					statusBarItem.tooltip = buildTooltip(snapshot);
					lastSnapshotHash = currentHash;
				}
				const measuredModels = snapshot.models.filter(m => m.remainingPercentage !== undefined);
				if (measuredModels.length === 0) {
					statusBarItem.text = '$(sparkle-filled) AI Data';
				} else {
					const minRemaining = Math.round(
						Math.min(...measuredModels.map(m => m.remainingPercentage ?? 100))
					);

					const icon = minRemaining < 15
						? '$(warning)'
						: minRemaining < 40
							? '$(alert)'
							: '$(sparkle-filled)';

					statusBarItem.text = `${icon} AI ${minRemaining}%`;
				}
			}

			return true;
		} catch (e) {
			console.error('[ai-data-id] Error fetching quota:', e);
			quotaManager.reset();
			statusBarItem.text = '$(warning) AI Data';
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

	const forceRefresh = async (): Promise<void> => {
		statusBarItem.text = '$(sync~spin) AI Data';
		if (lastSnapshot && !isFetching) {
			statusBarItem.tooltip = buildTooltip(lastSnapshot, true);
		}
		await fetchAndUpdateQuota(true);
	};

	// Refresh command (used from the tooltip link)
	const refreshCmd = vscode.commands.registerCommand('atm.dataId.refreshConsumption', forceRefresh);

	// Status bar click command
	const showCmd = vscode.commands.registerCommand('atm.dataId.showConsumption', forceRefresh);

	// Initial fetch with a small delay to avoid blocking IDE startup
	fetchTimer = setTimeout(() => fetchAndUpdateQuota(), INITIAL_DELAY_MS);

	// Proper cleanup on extension deactivation
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

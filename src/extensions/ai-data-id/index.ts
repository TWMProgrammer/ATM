import * as vscode from 'vscode';
import { ProcessFinder } from './core/process-finder';
import { QuotaManager } from './core/quota-manager';
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

	async function fetchAndUpdateQuota(): Promise<void> {
		try {
			let connectionInfo = quotaManager.getConnectionInfo();

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
					return;
				}
			}

			// Fetch quota data via local HTTPS
			const snapshot = await quotaManager.fetchQuota();
			if (snapshot) {
				statusBarItem.tooltip = buildTooltip(snapshot);
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
		} catch (e) {
			console.error('[ai-data-id] Error fetching quota:', e);
			quotaManager.reset();
			statusBarItem.text = '$(warning) AI Data';
			statusBarItem.tooltip = new vscode.MarkdownString(
				'Partial connection error. Will retry automatically...'
			);
		}
	}

	// Refresh command (used from the tooltip link)
	const refreshCmd = vscode.commands.registerCommand('atm.dataId.refreshConsumption', async () => {
		statusBarItem.text = '$(sync~spin) AI Data';
		await fetchAndUpdateQuota();
		vscode.window.showInformationMessage('🗘 Refresh Antigravity (data). ✅');
	});

	// Status bar click command
	const showCmd = vscode.commands.registerCommand('atm.dataId.showConsumption', () => {
		vscode.commands.executeCommand('atm.dataId.refreshConsumption');
	});

	// Initial fetch with a small delay to avoid blocking IDE startup
	const initialTimeout = setTimeout(() => fetchAndUpdateQuota(), INITIAL_DELAY_MS);

	// Passive polling every 2 minutes
	const pollingInterval = setInterval(() => fetchAndUpdateQuota(), POLLING_INTERVAL_MS);

	// Proper cleanup on extension deactivation
	context.subscriptions.push(
		statusBarItem,
		refreshCmd,
		showCmd,
		{ dispose: () => clearTimeout(initialTimeout) },
		{ dispose: () => clearInterval(pollingInterval) },
	);
}

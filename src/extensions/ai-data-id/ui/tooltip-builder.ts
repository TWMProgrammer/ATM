import * as vscode from 'vscode';
import { QuotaSnapshot } from '../core/types';

/**
 * Builds a compact, rich Markdown tooltip for the AI Data status bar item.
 * Uses HTML spans with inline CSS for colored progress bars.
 */
export function buildTooltip(snapshot: QuotaSnapshot): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.isTrusted = true;
	md.supportHtml = true;

	md.appendMarkdown('#### $(sparkle) Antigravity AI Data\n');
	md.appendMarkdown('---\n\n');

	if (snapshot.models.length === 0) {
		md.appendMarkdown('*$(sync~spin) Waiting for quota data...*\n');
		return md;
	}

	for (const model of snapshot.models) {
		const isIncluded = model.remainingPercentage === undefined;

		if (isIncluded) {
			md.appendMarkdown(`$(check) **${model.label}** — *Included*\n\n`);
			continue;
		}

		const pct = Math.round(model.remainingPercentage!);
		const bar = generateProgressBar(pct);
		const pctColor = getStatusColor(pct);

		// Line 1: model name
		md.appendMarkdown(`**${model.label}**\n\n`);

		// Line 2: progress bar + colored percentage + reset time
		if (model.isExhausted) {
			md.appendMarkdown(`${bar} <span style="color:${pctColor};">${pct}%</span> &nbsp; $(error) Resets in **${model.timeUntilResetFormatted}**\n\n`);
		} else {
			md.appendMarkdown(`${bar} <span style="color:${pctColor};">${pct}%</span> &nbsp; $(clock) ${model.timeUntilResetFormatted}\n\n`);
		}
	}

	md.appendMarkdown('[$(refresh) Refresh usage statistics](command:atm.dataId.refreshConsumption)');
	return md;
}

/**
 * Generates a progress bar using colored Unicode blocks with HTML spans.
 * Uses inline CSS for colors instead of emoji blocks.
 */
function generateProgressBar(percentage: number): string {
	const totalBlocks = 12;
	const filled = Math.round((percentage / 100) * totalBlocks);
	const empty = Math.max(0, totalBlocks - filled);

	const color = getStatusColor(percentage);
	const filledBar = `<span style="color:${color};">${'█'.repeat(filled)}</span>`;
	const emptyBar = `<span style="color:#333;">${'█'.repeat(empty)}</span>`;

	return filledBar + emptyBar;
}

/** Returns a semantic color based on remaining percentage. */
function getStatusColor(percentage: number): string {
	if (percentage < 15) { return '#ef4444'; } // red — critical
	if (percentage < 40) { return '#eab308'; } // yellow — warning 
	if (percentage < 70) { return '#22d3ee'; } // cyan — moderate
	return '#4ade80'; // green — healthy
}

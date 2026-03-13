import * as vscode from 'vscode';
import { QuotaSnapshot } from '../core/types';

/**
 * Builds a rich Markdown tooltip for the status bar item,
 * displaying AI model quota usage with visual progress bars.
 */
export function buildTooltip(snapshot: QuotaSnapshot): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.isTrusted = true;
	md.supportHtml = true;

	md.appendMarkdown('### $(sparkle) Antigravity AI Data\n');
	md.appendMarkdown('---\n\n');

	if (snapshot.models.length === 0) {
		md.appendMarkdown('*$(sync~spin) Waiting for quota information...*\n');
		return md;
	}

	for (const model of snapshot.models) {
		const isIncluded = model.remainingPercentage === undefined;
		const percentageText = isIncluded ? 'Included' : `${Math.round(model.remainingPercentage!)}%`;

		md.appendMarkdown(`**${model.label}** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${percentageText}\n\n`);

		if (!isIncluded) {
			md.appendMarkdown(`${generateProgressBar(model.remainingPercentage!)}\n\n`);
		} else {
			md.appendMarkdown(`$(check) *Premium unlimited model*\n\n`);
		}

		if (model.isExhausted) {
			md.appendMarkdown(`$(error) Exhausted. Allowance resets in **${model.timeUntilResetFormatted}**.\n\n`);
		} else if (!isIncluded) {
			md.appendMarkdown(`$(clock) Allowance resets in ${model.timeUntilResetFormatted}.\n\n`);
		}

		md.appendMarkdown('---\n\n');
	}

	md.appendMarkdown('\n\n[$(refresh) Refresh usage statistics](command:atm.dataId.refreshConsumption)');
	return md;
}

/** Generates a visual progress bar using colored block emojis. */
function generateProgressBar(percentage: number): string {
	const totalBlocks = 18;
	const filled = Math.round((percentage / 100) * totalBlocks);
	const empty = Math.max(0, totalBlocks - filled);

	let colorBlock = '🟩';
	if (percentage < 15) {
		colorBlock = '🟥';
	} else if (percentage < 40) {
		colorBlock = '🟨';
	} else if (percentage < 70) {
		colorBlock = '🟦';
	}

	return colorBlock.repeat(filled) + '⬛'.repeat(empty);
}

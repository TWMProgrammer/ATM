import * as vscode from 'vscode';
import { QuotaSnapshot } from '../core/types';

/**
 * Builds a minimalist, modern Markdown tooltip with "glassmorphism" fades.
 */
export function buildTooltip(snapshot: QuotaSnapshot): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.isTrusted = true;
	md.supportHtml = true;
	md.supportThemeIcons = true;

	md.appendMarkdown('### <span style="color:#f4f4f5; font-weight:600;">AI Consumption</span>\n\n');
	md.appendMarkdown(`${buildTopSummary(snapshot)}\n\n`);
	md.appendMarkdown('<span style="color:#3f3f46;">─────────────────────────────────────────</span>\n\n');

	if (snapshot.models.length === 0) {
		md.appendMarkdown('*$(sync~spin) <span style="color:#a1a1aa;">Waiting for quota data...</span>*\n');
		return md;
	}

	const PREDEFINED_ORDER = [
		'Gemini 3.1 Pro (High)',
		'Gemini 3.1 Pro (Low)',
		'Gemini 3 Flash',
		'Claude Sonnet 4.6 (Thinking)',
		'Claude Opus 4.6 (Thinking)',
		'GPT-OSS 120B (Medium)'
	];

	const orderedModels = [...snapshot.models].sort((a, b) => {
		const aIndex = PREDEFINED_ORDER.indexOf(a.label);
		const bIndex = PREDEFINED_ORDER.indexOf(b.label);

		if (aIndex !== -1 && bIndex !== -1) { return aIndex - bIndex; }
		if (aIndex !== -1) { return -1; }
		if (bIndex !== -1) { return 1; }

		return a.label.localeCompare(b.label);
	});

	for (const model of orderedModels) {
		const isIncluded = model.remainingPercentage === undefined;
		const safeLabel = escapeInlineMarkdown(model.label);

		if (isIncluded) {
			md.appendMarkdown(`<span style="color:#f4f4f5;">**${safeLabel}**</span>  \n`);
			md.appendMarkdown(`$(pass) <span style="color:#a1a1aa;">Included in plan • Unlimited</span>\n\n`);
			continue;
		}

		const pct = Math.round(model.remainingPercentage!);
		const pctColor = getStatusColor(pct);
		const bar = generateModernBar(pct, pctColor);
		
		let resetText: string;
		if (model.isExhausted) {
			resetText = `$(history) <span style="color:#f87171;">${model.timeUntilResetFormatted}</span>`;
		} else {
			// Changed from clock to history to keep consistency and ensure it's a valid codicon
			resetText = `$(history) <span style="color:#a1a1aa;">${model.timeUntilResetFormatted}</span>`;
		}

		md.appendMarkdown(`<span style="color:#f4f4f5;">**${safeLabel}**</span>  \n`);
		md.appendMarkdown(`${bar} &nbsp;&nbsp; <span style="color:${pctColor};">**${pct}%**</span> &nbsp;&nbsp;<span style="color:#3f3f46;">|</span>&nbsp;&nbsp; ${resetText}\n\n`);
	}

	md.appendMarkdown('<span style="color:#3f3f46;">─────────────────────────────────────────</span>\n\n');
	
	md.appendMarkdown(`<span style="color:#a1a1aa;">Last update: ${formatTimestamp(snapshot.timestamp)}</span> &nbsp;&nbsp;<span style="color:#3f3f46;">|</span>&nbsp;&nbsp; [$(refresh) Refresh Usage](command:atm.dataId.refreshConsumption)`);
	
	return md;
}

function buildTopSummary(snapshot: QuotaSnapshot): string {
	const measured = snapshot.models.filter(m => m.remainingPercentage !== undefined);
	const totalMeasured = measured.length;
	const exhausted = measured.filter(m => m.isExhausted).length;
	const critical = measured.filter(m => (m.remainingPercentage ?? 100) < 15 && !m.isExhausted).length;

	if (totalMeasured === 0) {
		return '*<span style="color:#a1a1aa;">Discovering available models...</span>*';
	}

	const lowest = Math.round(Math.min(...measured.map(m => m.remainingPercentage ?? 100)));
	const healthColor = getStatusColor(lowest);
	const safeZone = Math.max(totalMeasured - exhausted - critical, 0);

	return [
		`<span style="color:#a1a1aa;">Lowest:</span> <span style="color:${healthColor};">**${lowest}%**</span>`,
		`<span style="color:#a1a1aa;">Healthy:</span> <span style="color:#4ade80;">**${safeZone}/${totalMeasured}**</span>`,
		critical > 0 ? `<span style="color:#facc15;">Low: ${critical}</span>` : '',
		exhausted > 0 ? `<span style="color:#f87171;">Exhausted: ${exhausted}</span>` : '',
	].filter(Boolean).join(' &nbsp;&nbsp;<span style="color:#3f3f46;">|</span>&nbsp;&nbsp; ');
}

/**
 * Generates a modern minimalist progress bar.
 * Applies a fade/gradient via alpha channel to simulate glassmorphism and modern UI.
 */
function generateModernBar(pct: number, baseColor: string): string {
	const totalBlocks = 15; // 15 dots for a smooth fade
	const filled = Math.round((pct / 100) * totalBlocks);

	let bar = '';
	for (let i = 0; i < totalBlocks; i++) {
		if (i < filled) {
			// Fade degradado: interpolates opacity from 100% (FF) to 35% (5A)
			const progress = filled > 1 ? i / (filled - 1) : 0;
			const alphaInt = Math.round(255 - (progress * 165)); // 255 to 90
			const alphaHex = alphaInt.toString(16).padStart(2, '0');
			
			bar += `<span style="color:${baseColor}${alphaHex};">●</span> `;
		} else {
			// Glassmorphism effect: very faint transparent background pattern
			bar += `<span style="color:#ffffff0f;">●</span> `;
		}
	}
	return bar.trimEnd();
}

function escapeInlineMarkdown(value: string): string {
	return value.replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function formatTimestamp(date: Date): string {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStatusColor(percentage: number): string {
	if (percentage < 15) { return '#f87171'; } // red-400
	if (percentage < 40) { return '#facc15'; } // yellow-400
	if (percentage < 70) { return '#22d3ee'; } // cyan-400
	return '#4ade80'; // green-400
}

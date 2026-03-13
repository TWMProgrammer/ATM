import * as vscode from 'vscode';
import { QuotaSnapshot } from '../core/types';

// ── Constants ────────────────────────────────────────────────────────

/** Number of dots in the progress bar visualization. */
const PROGRESS_BAR_SEGMENTS = 15;

/** Alpha range for the gradient fade effect (255 = fully opaque, 90 = faded). */
const ALPHA_START = 255;
const ALPHA_END = 90;

/** Color for unfilled progress bar segments (glassmorphism ghost dots). */
const UNFILLED_SEGMENT_COLOR = '#ffffff0f';

// ── Status colors (Tailwind CSS palette) ─────────────────────────────

const COLOR_DANGER = '#f87171';  // red-400    — quota < 15%
const COLOR_WARNING = '#facc15'; // yellow-400 — quota < 40%
const COLOR_INFO = '#22d3ee';    // cyan-400   — quota < 70%
const COLOR_HEALTHY = '#4ade80'; // green-400  — quota ≥ 70%

// ── Theme-neutral text colors ────────────────────────────────────────

const COLOR_TEXT_PRIMARY = '#f4f4f5';   // zinc-100
const COLOR_TEXT_SECONDARY = '#a1a1aa'; // zinc-400
const COLOR_SEPARATOR = '#3f3f46';      // zinc-700

// ── Model display order ──────────────────────────────────────────────

/**
 * Preferred display order for known models.
 * Models not in this list are sorted alphabetically after the known ones.
 * When models are renamed server-side, only this list needs updating.
 */
const MODEL_DISPLAY_ORDER: readonly string[] = [
	'Gemini 3.1 Pro (High)',
	'Gemini 3.1 Pro (Low)',
	'Gemini 3 Flash',
	'Claude Sonnet 4.6 (Thinking)',
	'Claude Opus 4.6 (Thinking)',
	'GPT-OSS 120B (Medium)',
];

// ── Separator line ───────────────────────────────────────────────────

const DIVIDER = `<span style="color:${COLOR_SEPARATOR};">─────────────────────────────────────────</span>\n\n`;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Builds a minimalist, modern Markdown tooltip with glassmorphism visual effects.
 *
 * @param snapshot  - The current quota data to render.
 * @param isRefreshing - Whether a refresh is currently in progress.
 * @returns A `MarkdownString` ready to be assigned to a status bar item's tooltip.
 */
export function buildTooltip(snapshot: QuotaSnapshot, isRefreshing = false): vscode.MarkdownString {
	const md = new vscode.MarkdownString();
	md.isTrusted = true;
	md.supportHtml = true;
	md.supportThemeIcons = true;

	md.appendMarkdown(`### <span style="color:${COLOR_TEXT_PRIMARY}; font-weight:600;">Antigravity Quota - AI (Data)</span>\n\n`);
	md.appendMarkdown(`${buildTopSummary(snapshot)}\n\n`);
	md.appendMarkdown(DIVIDER);

	if (snapshot.models.length === 0) {
		md.appendMarkdown(`*$(sync~spin) <span style="color:${COLOR_TEXT_SECONDARY};">Waiting for quota data...</span>*\n`);
		return md;
	}

	const orderedModels = sortModelsByDisplayOrder(snapshot.models);

	for (const model of orderedModels) {
		md.appendMarkdown(buildModelRow(model));
	}

	md.appendMarkdown(DIVIDER);
	md.appendMarkdown(buildFooter(snapshot.timestamp, isRefreshing));

	return md;
}

// ── Internal builders ────────────────────────────────────────────────

/** Renders the summary line with credits, health, and alert counts. */
function buildTopSummary(snapshot: QuotaSnapshot): string {
	const measured = snapshot.models.filter(m => m.remainingPercentage !== undefined);
	const totalMeasured = measured.length;
	const exhausted = measured.filter(m => m.isExhausted).length;
	const critical = measured.filter(m => (m.remainingPercentage ?? 100) < 15 && !m.isExhausted).length;
	const credits = snapshot.promptCredits;

	const parts: string[] = [];
	if (credits) {
		parts.push(
			`$(account) <span style="color:${COLOR_TEXT_SECONDARY};">Credits:</span> <span style="color:${COLOR_TEXT_PRIMARY};">**${credits.available}/${credits.monthly}**</span>`,
			`$(pulse) <span style="color:${getStatusColor(Math.round(credits.remainingPercentage))};">${Math.round(credits.remainingPercentage)}% left</span>`
		);
	}

	if (totalMeasured === 0) {
		parts.push(`*<span style="color:${COLOR_TEXT_SECONDARY};">Discovering available models...</span>*`);
		return joinWithSeparator(parts);
	}

	const safeZone = Math.max(totalMeasured - exhausted - critical, 0);

	parts.push(...[
		`$(heart) <span style="color:${COLOR_TEXT_SECONDARY};">Healthy:</span> <span style="color:${COLOR_HEALTHY};">**${safeZone}/${totalMeasured}**</span>`,
		critical > 0 ? `$(warning) <span style="color:${COLOR_WARNING};">Low: ${critical}</span>` : '',
		exhausted > 0 ? `$(error) <span style="color:${COLOR_DANGER};">Exhausted: ${exhausted}</span>` : '',
	]);

	return joinWithSeparator(parts.filter(Boolean));
}

/** Renders a single model row with its progress bar, percentage, and reset time. */
function buildModelRow(model: QuotaSnapshot['models'][number]): string {
	const isUnlimited = model.remainingPercentage === undefined;
	const safeLabel = escapeInlineMarkdown(model.label);

	if (isUnlimited) {
		return (
			`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
			`$(pass) <span style="color:${COLOR_TEXT_SECONDARY};">Included in plan • Unlimited</span>\n\n`
		);
	}

	const pct = Math.round(model.remainingPercentage!);
	const pctColor = getStatusColor(pct);
	const bar = generateModernBar(pct, pctColor);

	const resetColor = model.isExhausted ? COLOR_DANGER : COLOR_TEXT_SECONDARY;
	const resetText = `$(history) <span style="color:${resetColor};">${model.timeUntilResetFormatted}</span>`;

	return (
		`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
		`${bar} &nbsp;&nbsp; <span style="color:${pctColor};">**${pct}%**</span> &nbsp;&nbsp;` +
		`<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; ${resetText}\n\n`
	);
}

/** Renders the footer with last-update timestamp and refresh link. */
function buildFooter(timestamp: Date, isRefreshing: boolean): string {
	const refreshIcon = isRefreshing ? '$(sync~spin)' : '$(refresh)';
	const refreshText = isRefreshing ? 'Refreshing...' : 'Refresh Usage';
	const refreshLink = isRefreshing
		? `<span style="color:${COLOR_TEXT_SECONDARY};">${refreshIcon} ${refreshText}</span>`
		: `[${refreshIcon} ${refreshText}](command:atm.dataId.refreshConsumption)`;

	return (
		`<span style="color:${COLOR_TEXT_SECONDARY};">Last update: ${formatTimestamp(timestamp)}</span>` +
		` &nbsp;&nbsp;<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; ${refreshLink}`
	);
}

// ── Pure utility functions ───────────────────────────────────────────

/**
 * Sorts models by the predefined display order, with unknown models
 * sorted alphabetically at the end.
 */
function sortModelsByDisplayOrder(models: QuotaSnapshot['models']): QuotaSnapshot['models'] {
	return [...models].sort((a, b) => {
		const aIndex = MODEL_DISPLAY_ORDER.indexOf(a.label);
		const bIndex = MODEL_DISPLAY_ORDER.indexOf(b.label);

		if (aIndex !== -1 && bIndex !== -1) { return aIndex - bIndex; }
		if (aIndex !== -1) { return -1; }
		if (bIndex !== -1) { return 1; }

		return a.label.localeCompare(b.label);
	});
}

/**
 * Generates a modern minimalist progress bar using filled dots.
 * Applies a gradient via alpha interpolation to simulate glassmorphism.
 */
export function generateModernBar(pct: number, baseColor: string): string {
	const filled = Math.round((pct / 100) * PROGRESS_BAR_SEGMENTS);

	let bar = '';
	for (let i = 0; i < PROGRESS_BAR_SEGMENTS; i++) {
		if (i < filled) {
			// Gradient fade: interpolates opacity from ALPHA_START to ALPHA_END
			const progress = filled > 1 ? i / (filled - 1) : 0;
			const alphaInt = Math.round(ALPHA_START - (progress * (ALPHA_START - ALPHA_END)));
			const alphaHex = alphaInt.toString(16).padStart(2, '0');

			bar += `<span style="color:${baseColor}${alphaHex};">●</span> `;
		} else {
			bar += `<span style="color:${UNFILLED_SEGMENT_COLOR};">●</span> `;
		}
	}
	return bar.trimEnd();
}

/** Escapes Markdown special characters inside inline text. */
function escapeInlineMarkdown(value: string): string {
	return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}

/** Formats a `Date` as a compact time string (HH:MM:SS). */
function formatTimestamp(date: Date): string {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Maps a remaining-percentage value to a status color.
 *
 * | Range     | Color   | Meaning |
 * |-----------|---------|---------|
 * | 0–14%     | Red     | Danger  |
 * | 15–39%    | Yellow  | Warning |
 * | 40–69%    | Cyan    | Info    |
 * | 70–100%   | Green   | Healthy |
 */
export function getStatusColor(percentage: number): string {
	if (percentage < 15) { return COLOR_DANGER; }
	if (percentage < 40) { return COLOR_WARNING; }
	if (percentage < 70) { return COLOR_INFO; }
	return COLOR_HEALTHY;
}

/** Joins parts with a styled vertical separator. */
function joinWithSeparator(parts: string[]): string {
	return parts.join(` &nbsp;&nbsp;<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; `);
}

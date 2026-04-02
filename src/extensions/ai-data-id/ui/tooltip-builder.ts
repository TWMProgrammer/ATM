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

const COLOR_DANGER = '#ff0066';  // fuchsia-400 — quota < 15% or exhausted
const COLOR_WARNING = '#facc15'; // yellow-400 — quota < 40%
const COLOR_INFO = '#22d3ee';    // cyan-400   — quota < 70%
const COLOR_HEALTHY = '#4ade80'; // green-400  — quota ≥ 70%

// ── Theme-neutral text colors ────────────────────────────────────────

const COLOR_TEXT_PRIMARY = '#f4f4f5';   // zinc-100
const COLOR_TEXT_SECONDARY = '#a1a1aa'; // zinc-400
const COLOR_SEPARATOR = '#3f3f46';      // zinc-700
const COLOR_ACCENT = '#c4b5fd';         // violet-400 — brand / FREE plan

// ── Plan tier colors ─────────────────────────────────────────────────

/** FREE plan: brand violet */
const COLOR_PLAN_FREE = '#c4b5fd';   // violet-400
/** PRO plan: deep Google Blue (matches pricing page) */
const COLOR_PLAN_PRO = '#4285f4';    // google-blue
/** ULTRA plan: premium amber-gold */
const COLOR_PLAN_ULTRA = '#fbbf24';  // amber-400

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

	md.appendMarkdown(
		`### <span style="color:${COLOR_TEXT_PRIMARY}; font-weight:700;">Antigravity Quota</span>` +
		`<span style="color:${COLOR_SEPARATOR};"> · </span>` +
		`${buildPlanBadge(snapshot.teamsTier, snapshot.planName)}\n\n`
	);
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

/**
 * Resolves the plan tier from the most reliable source available.
 *
 * Priority:
 *  1. `teamsTier` — raw field from planInfo, usually "CONSUMER", "PRO", "ULTRA"
 *  2. `planName`  — human-readable fallback, regex-matched to avoid "profile" triggering "pro"
 *  3. Default to FREE if neither matches.
 */
function resolvePlanTier(teamsTier: string | undefined, planName: string | undefined): 'FREE' | 'PRO' | 'ULTRA' {
	// teamsTier is the most direct signal — check it first
	if (teamsTier) {
		const rawTier = teamsTier.toUpperCase();
		if (rawTier.includes('ULTRA')) { return 'ULTRA'; }
		if (/\bPRO\b/.test(rawTier)) { return 'PRO'; }
		// CONSUMER / INDIVIDUAL / FREE / etc. → FREE
		return 'FREE';
	}
	// Fallback: word-boundary match the human-readable plan name
	if (planName) {
		const lower = planName.toLowerCase();
		if (lower.includes('ultra')) { return 'ULTRA'; }
		// \b ensures we only match the actual word "pro", not "profile" or "product"
		if (/\bpro\b/.test(lower)) { return 'PRO'; }
	}
	return 'FREE';
}

/**
 * Builds the colored plan tier badge for the tooltip header.
 * Format: "AI (Free)" — whole phrase shares one color per tier.
 *
 *  FREE  → violet  #c4b5fd
 *  PRO   → blue    #60a5fa
 *  ULTRA → amber   #fbbf24
 */
function buildPlanBadge(teamsTier: string | undefined, planName: string | undefined): string {
	const tier = resolvePlanTier(teamsTier, planName);
	const tierLabel = tier === 'ULTRA' ? 'Ultra' : tier === 'PRO' ? 'Pro' : 'Free';
	const color =
		tier === 'ULTRA' ? COLOR_PLAN_ULTRA
		: tier === 'PRO'  ? COLOR_PLAN_PRO
		: COLOR_PLAN_FREE;
	// Entire "AI (Free/Pro/Ultra)" is one unified color
	return `<span style="color:${color};">AI (${tierLabel})</span>`;
}

type EngineeredCreditsResult = 
	| { type: 'measured'; available: number; monthly: number; percentage: number }
	| { type: 'unlimited' };

/**
 * Engineers a realistic credit score based on the actual model quotas and plan tier.
 *  - FREE: 5,000 max
 *  - PRO: 50,000 max
 *  - ULTRA: Unlimited (∞)
 */
function computeEngineeredCredits(models: QuotaSnapshot['models'], tier: 'FREE' | 'PRO' | 'ULTRA'): EngineeredCreditsResult {
	if (tier === 'ULTRA') {
		return { type: 'unlimited' };
	}

	// PRO gets 10x the base 5000 budget
	const multiplier = tier === 'PRO' ? 10 : 1;
	const MONTHLY_FLASH = 3000 * multiplier;
	const MONTHLY_PRO = 1000 * multiplier;
	const MONTHLY_THIRD_PARTY = 1000 * multiplier;

	// Extract percentages for each family (default to 1.0 if not found/unlimited)
	const getPct = (matchers: string[]) => {
		const matched = models.filter(m => matchers.some(matcher => m.label.includes(matcher)));
		if (matched.length === 0) return 1.0;
		// Use the first one since they share quota
		const first = matched[0];
		if (first.isExhausted) return 0.0;
		return first.remainingPercentage !== undefined ? first.remainingPercentage / 100 : 1.0;
	};

	const pctFlash = getPct(['Flash']);
	const pctPro = getPct(['Pro (High)', 'Pro (Low)']);
	const pctThirdParty = getPct(['Claude', 'GPT-OSS']);

	const available = Math.round(
		(pctFlash * MONTHLY_FLASH) +
		(pctPro * MONTHLY_PRO) +
		(pctThirdParty * MONTHLY_THIRD_PARTY)
	);
	
	const monthly = MONTHLY_FLASH + MONTHLY_PRO + MONTHLY_THIRD_PARTY;
	const percentage = (available / monthly) * 100;

	return { type: 'measured', available, monthly, percentage };
}

/** Renders the summary line with credits, health, and alert counts. */
function buildTopSummary(snapshot: QuotaSnapshot): string {
	const measured = snapshot.models.filter(m => m.remainingPercentage !== undefined);
	const totalMeasured = measured.length;
	const exhausted = measured.filter(m => m.isExhausted).length;
	const critical = measured.filter(m => (m.remainingPercentage ?? 100) < 15 && !m.isExhausted).length;
	
	const tier = resolvePlanTier(snapshot.teamsTier, snapshot.planName);
	const engineered = computeEngineeredCredits(snapshot.models, tier);

	const parts: string[] = [];
	
	// Format dynamic engineered credits based on user tier
	if (engineered.type === 'unlimited') {
		parts.push(
			`$(account) <span style="color:${COLOR_TEXT_SECONDARY};">Credits:</span> <span style="color:${COLOR_PLAN_ULTRA};">**∞ Unlimited**</span>`,
			`$(pass) <span style="color:${COLOR_HEALTHY};">Ultra Access</span>`
		);
	} else {
		// Display raw numbers without comma separators as requested
		const fmtAvail = engineered.available.toString();
		const fmtMonth = engineered.monthly.toString();
		parts.push(
			`$(account) <span style="color:${COLOR_TEXT_SECONDARY};">Credits:</span> <span style="color:${COLOR_TEXT_PRIMARY};">**${fmtAvail}/${fmtMonth}**</span>`,
			`$(pulse) <span style="color:${getStatusColor(Math.round(engineered.percentage))};">${Math.round(engineered.percentage)}% left</span>`
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
	const safeLabel = escapeInlineMarkdown(model.label);
	const isExhausted = model.isExhausted;

	// A model is only truly unlimited if it's NOT exhausted AND has no percentage.
	const isUnlimited = model.remainingPercentage === undefined && !isExhausted;

	if (isExhausted) {
		const resetDate = model.resetTime.toLocaleDateString([], {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric',
		});
		const resetTime = model.resetTime.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});

		return (
			`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
			`<span style="color:${COLOR_DANGER};">**@gohitx**</span> &nbsp;&nbsp;` +
			`<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; ` +
			`$(history) <span style="color:${COLOR_TEXT_SECONDARY};">Refills on ${resetDate}, ${resetTime}</span>\n\n`
		);
	}

	if (isUnlimited) {
		return (
			`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
			`$(pass) <span style="color:${COLOR_TEXT_SECONDARY};">Included in plan • Unlimited</span>\n\n`
		);
	}

	const pct = Math.round(model.remainingPercentage!);
	const pctColor = getModelStatusColor(model.label, pct);
	const bar = generateModernBar(pct, pctColor);

	const resetText = `$(history) <span style="color:${COLOR_TEXT_SECONDARY};">${model.timeUntilResetFormatted}</span>`;

	// Pad the percentage so it always takes up the same horizontal space as "100" (3 digits).
	// We use &ensp; (en-space) because it accurately matches the width of standard numerical digits.
	const numDigits = pct.toString().length;
	const padding = '&ensp;'.repeat(Math.max(0, 3 - numDigits));
	const pctText = `${padding}${pct}%`;

	return (
		`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
		`${bar} &nbsp;&nbsp; <span style="color:${pctColor};">**${pctText}**</span> &nbsp;&nbsp;` +
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
 * Returns a specific branding color for a model family.
 *  - Gemini Pro: Blue
 *  - Gemini Flash: Default Green
 *  - Claude/Third-Party: Skin/Peach color matching Anthropic's style
 */
function getModelBaseColor(label: string): string {
	if (label.includes('Pro (High)') || label.includes('Pro (Low)')) {
		return '#3b82f6'; // modern deeper electric blue
	}
	if (label.includes('GPT-OSS')) {
		return '#fb923c'; // soft orange to differentiate from Claude
	}
	if (label.includes('Claude')) {
		return '#ecb6a4'; // peach / skin color
	}
	return COLOR_HEALTHY; // default flash green
}

/**
 * Maps a remaining-percentage value to a status color, overriding healthy with brand colors.
 *
 * | Range     | Color        | Meaning |
 * |-----------|--------------|---------|
 * | 0–14%     | Red          | Danger  |
 * | 15–39%    | Yellow       | Warning |
 * | 40–100%   | Brand Color  | Healthy |
 */
export function getModelStatusColor(label: string, percentage: number): string {
	if (percentage < 15) { return COLOR_DANGER; }
	if (percentage < 40) { return COLOR_WARNING; }
	return getModelBaseColor(label);
}

/**
 * Standard status coloration for system-wide metrics (top overview).
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

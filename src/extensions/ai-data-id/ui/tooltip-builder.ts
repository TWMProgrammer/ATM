import * as vscode from 'vscode';
import { QuotaSnapshot } from '../core/types';

// ── Constants ────────────────────────────────────────────────────────

const PROGRESS_BAR_SEGMENTS = 15;

const ALPHA_START = 255;
const ALPHA_END   = 90;

const UNFILLED_SEGMENT_COLOR = '#ffffff0f';

// ── Status colors ────────────────────────────────────────────────────

const COLOR_DANGER  = '#ff0066';  // quota < 15% or exhausted
const COLOR_WARNING = '#facc15';  // system-wide fallback warning
const COLOR_INFO    = '#22d3ee';  // system-wide info
const COLOR_HEALTHY = '#4ade80';  // system-wide healthy

// ── Text & UI colors ─────────────────────────────────────────────────

const COLOR_TEXT_PRIMARY   = '#f4f4f5';  // zinc-100
const COLOR_TEXT_SECONDARY = '#a1a1aa';  // zinc-400
const COLOR_SEPARATOR      = '#3f3f46';  // zinc-700

// ── Plan tier colors ─────────────────────────────────────────────────

const COLOR_PLAN_FREE  = '#c4b5fd';  // violet-400
const COLOR_PLAN_PRO   = '#4285f4';  // google-blue
const COLOR_PLAN_ULTRA = '#fbbf24';  // amber-400

// ── Model display order ──────────────────────────────────────────────

const MODEL_DISPLAY_ORDER: readonly string[] = [
	'Gemini 3.1 Pro (High)',
	'Gemini 3.1 Pro (Low)',
	'Gemini 3 Flash',
	'Claude Sonnet 4.6 (Thinking)',
	'Claude Opus 4.6 (Thinking)',
	'GPT-OSS 120B (Medium)',
];

// ── Separator ────────────────────────────────────────────────────────

const DIVIDER = `<span style="color:${COLOR_SEPARATOR};">─────────────────────────────────────────</span>\n\n`;

// ── Public API ───────────────────────────────────────────────────────

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

	for (const model of sortModelsByDisplayOrder(snapshot.models)) {
		md.appendMarkdown(buildModelRow(model));
	}

	md.appendMarkdown(DIVIDER);
	md.appendMarkdown(buildFooter(snapshot.timestamp, isRefreshing));

	return md;
}

// ── Plan tier ────────────────────────────────────────────────────────

/**
 * Resolves plan tier from the most reliable source available.
 * Priority: teamsTier → planName → FREE fallback.
 */
export function resolvePlanTier(teamsTier: string | undefined, planName: string | undefined): 'FREE' | 'PRO' | 'ULTRA' {
	if (teamsTier) {
		const t = teamsTier.toUpperCase();
		if (t.includes('ULTRA'))   { return 'ULTRA'; }
		if (/\bPRO\b/.test(t))     { return 'PRO'; }
		return 'FREE';
	}
	if (planName) {
		const p = planName.toLowerCase();
		if (p.includes('ultra'))   { return 'ULTRA'; }
		if (/\bpro\b/.test(p))     { return 'PRO'; }
	}
	return 'FREE';
}

function buildPlanBadge(teamsTier: string | undefined, planName: string | undefined): string {
	const tier  = resolvePlanTier(teamsTier, planName);
	const label = tier === 'ULTRA' ? 'Ultra' : tier === 'PRO' ? 'Pro' : 'Free';
	const color = tier === 'ULTRA' ? COLOR_PLAN_ULTRA : tier === 'PRO' ? COLOR_PLAN_PRO : COLOR_PLAN_FREE;
	return `<span style="color:${color};">AI (${label})</span>`;
}

// ── Engineered credits ───────────────────────────────────────────────

export type EngineeredCreditsResult =
	| { type: 'measured'; available: number; monthly: number; percentage: number }
	| { type: 'unlimited' };

/**
 * Computes a synthetic credit score from model quotas.
 * FREE: 5 000 max · PRO: 50 000 max · ULTRA: unlimited.
 */
export function computeEngineeredCredits(models: QuotaSnapshot['models'], tier: 'FREE' | 'PRO' | 'ULTRA'): EngineeredCreditsResult {
	if (tier === 'ULTRA') { return { type: 'unlimited' }; }

	const mult           = tier === 'PRO' ? 10 : 1;
	const MONTHLY_FLASH  = 3000 * mult;
	const MONTHLY_PRO    = 1000 * mult;
	const MONTHLY_THIRD  = 1000 * mult;

	const getPct = (matchers: string[]) => {
		const match = models.filter(m => matchers.some(s => m.label.includes(s)));
		if (!match.length) { return 1.0; }
		const first = match[0];
		if (first.isExhausted) { return 0.0; }
		return first.remainingPercentage !== undefined ? first.remainingPercentage / 100 : 1.0;
	};

	const available = Math.round(
		getPct(['Flash'])                  * MONTHLY_FLASH +
		getPct(['Pro (High)', 'Pro (Low)']) * MONTHLY_PRO   +
		getPct(['Claude', 'GPT-OSS'])      * MONTHLY_THIRD
	);

	const monthly    = MONTHLY_FLASH + MONTHLY_PRO + MONTHLY_THIRD;
	const percentage = (available / monthly) * 100;

	return { type: 'measured', available, monthly, percentage };
}

// ── Tooltip sections ─────────────────────────────────────────────────

function buildTopSummary(snapshot: QuotaSnapshot): string {
	const measured     = snapshot.models.filter(m => m.remainingPercentage !== undefined);
	const totalMeasured = measured.length;
	const exhausted    = measured.filter(m => m.isExhausted).length;
	const critical     = measured.filter(m => (m.remainingPercentage ?? 100) < 15 && !m.isExhausted).length;

	const tier       = resolvePlanTier(snapshot.teamsTier, snapshot.planName);
	const engineered = computeEngineeredCredits(snapshot.models, tier);
	const parts: string[] = [];

	if (engineered.type === 'unlimited') {
		parts.push(
			`$(account) <span style="color:${COLOR_TEXT_SECONDARY};">Credits:</span> <span style="color:${COLOR_PLAN_ULTRA};">**∞ Unlimited**</span>`,
			`$(pass) <span style="color:${COLOR_HEALTHY};">Ultra Access</span>`
		);
	} else {
		parts.push(
			`$(account) <span style="color:${COLOR_TEXT_SECONDARY};">Credits:</span> <span style="color:${COLOR_TEXT_PRIMARY};">**${engineered.available}/${engineered.monthly}**</span>`,
			`$(pulse) <span style="color:${getStatusColor(Math.round(engineered.percentage))};">${Math.round(engineered.percentage)}% left</span>`
		);
	}

	if (totalMeasured === 0) {
		parts.push(`*<span style="color:${COLOR_TEXT_SECONDARY};">Discovering available models...</span>*`);
		return joinWithSeparator(parts);
	}

	const safeZone = Math.max(totalMeasured - exhausted - critical, 0);
	parts.push(
		`$(heart) <span style="color:${COLOR_TEXT_SECONDARY};">Healthy:</span> <span style="color:${COLOR_HEALTHY};">**${safeZone}/${totalMeasured}**</span>`,
		...(critical  > 0 ? [`$(warning) <span style="color:${COLOR_WARNING};">Low: ${critical}</span>`]         : []),
		...(exhausted > 0 ? [`$(error) <span style="color:${COLOR_DANGER};">Exhausted: ${exhausted}</span>`]     : []),
	);

	return joinWithSeparator(parts);
}

function buildModelRow(model: QuotaSnapshot['models'][number]): string {
	const safeLabel   = escapeInlineMarkdown(model.label);
	const isExhausted = model.isExhausted;
	const isUnlimited = model.remainingPercentage === undefined && !isExhausted;

	if (isExhausted) {
		const resetDate = model.resetTime.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
		const resetTime = model.resetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

	const pct      = Math.round(model.remainingPercentage!);
	const pctColor = getModelStatusColor(model.label, pct);
	const bar      = generateModernBar(pct, pctColor);
	const padding  = '&ensp;'.repeat(Math.max(0, 3 - pct.toString().length));

	return (
		`<span style="color:${COLOR_TEXT_PRIMARY};">**${safeLabel}**</span>  \n` +
		`${bar} &nbsp;&nbsp; <span style="color:${pctColor};">**${padding}${pct}%**</span> &nbsp;&nbsp;` +
		`<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; ` +
		`$(history) <span style="color:${COLOR_TEXT_SECONDARY};">${model.timeUntilResetFormatted}</span>\n\n`
	);
}

function buildFooter(timestamp: Date, isRefreshing: boolean): string {
	const icon = isRefreshing ? '$(sync~spin)' : '$(refresh)';
	const text = isRefreshing ? 'Refreshing...' : 'Refresh Usage';
	const link = isRefreshing
		? `<span style="color:${COLOR_TEXT_SECONDARY};">${icon} ${text}</span>`
		: `[${icon} ${text}](command:atm.dataId.refreshConsumption)`;

	return (
		`<span style="color:${COLOR_TEXT_SECONDARY};">Last update: ${formatTimestamp(timestamp)}</span>` +
		` &nbsp;&nbsp;<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; ${link}`
	);
}

// ── Utilities ────────────────────────────────────────────────────────

function sortModelsByDisplayOrder(models: QuotaSnapshot['models']): QuotaSnapshot['models'] {
	return [...models].sort((a, b) => {
		const ai = MODEL_DISPLAY_ORDER.indexOf(a.label);
		const bi = MODEL_DISPLAY_ORDER.indexOf(b.label);
		if (ai !== -1 && bi !== -1) { return ai - bi; }
		if (ai !== -1) { return -1; }
		if (bi !== -1) { return  1; }
		return a.label.localeCompare(b.label);
	});
}

export function generateModernBar(pct: number, baseColor: string): string {
	const filled = Math.round((pct / 100) * PROGRESS_BAR_SEGMENTS);
	let bar = '';
	for (let i = 0; i < PROGRESS_BAR_SEGMENTS; i++) {
		if (i < filled) {
			const progress = filled > 1 ? i / (filled - 1) : 0;
			const alphaHex = Math.round(ALPHA_START - progress * (ALPHA_START - ALPHA_END))
				.toString(16).padStart(2, '0');
			bar += `<span style="color:${baseColor}${alphaHex};">●</span> `;
		} else {
			bar += `<span style="color:${UNFILLED_SEGMENT_COLOR};">●</span> `;
		}
	}
	return bar.trimEnd();
}

function escapeInlineMarkdown(value: string): string {
	return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}

function formatTimestamp(date: Date): string {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Per-model color palette. Degrades as quota drops.
 * API returns exact cuts only: 100 → 80 → 60 → 40 → 20 → exhausted.
 */
export function getModelStatusColor(label: string, percentage: number): string {
	if (percentage < 15) { return COLOR_DANGER; }

	// Gemini Pro — blue family fading to teal then warm
	if (label.includes('Pro (High)') || label.includes('Pro (Low)')) {
		if (percentage >= 80) { return '#60a5fa'; } // Blue          (100% / 80%)
		if (percentage >= 60) { return '#38bdf8'; } // Sky blue      (60%)
		if (percentage >= 40) { return '#2dd4bf'; } // Teal          (40%)
		return '#eab308';                            // Amber         (20%)
	}

	// GPT-OSS — orange fading to red (shares quota pool with Claude)
	if (label.includes('GPT-OSS')) {
		if (percentage >= 80) { return '#fb923c'; } // Orange        (100% / 80%)
		if (percentage >= 60) { return '#ef4444'; } // Red           (60%)
		if (percentage >= 40) { return '#dc2626'; } // Crimson       (40%)
		return '#eab308';                            // Amber         (20%)
	}

	// Claude — warm peach fading to orange (shares quota pool with GPT-OSS)
	if (label.includes('Claude')) {
		if (percentage > 80)  { return '#ecb6a4'; } // Peach         (100%)
		if (percentage >= 80) { return '#fdba74'; } // Warm peach    (80%)
		if (percentage >= 60) { return '#fb923c'; } // Soft orange   (60%)
		if (percentage >= 40) { return '#f97316'; } // Orange        (40%)
		return '#fde047';                            // Amber         (20%)
	}

	// Gemini Flash — green family fading to amber
	if (percentage >= 80) { return '#22c55e'; } // Green         (100% / 80%)
	if (percentage >= 60) { return '#10b981'; } // Teal green    (60%)
	if (percentage >= 40) { return '#84cc16'; } // Lime          (40%)
	if (percentage >= 20) { return '#eab308'; } // Amber         (20%)
	return '#f97316';                            // Orange        (safety net)
}

/**
 * System-wide status color for aggregate metrics (top summary bar).
 */
export function getStatusColor(percentage: number): string {
	if (percentage < 15) { return COLOR_DANGER; }
	if (percentage < 40) { return COLOR_WARNING; }
	if (percentage < 70) { return COLOR_INFO; }
	return COLOR_HEALTHY;
}

function joinWithSeparator(parts: string[]): string {
	return parts.join(` &nbsp;&nbsp;<span style="color:${COLOR_SEPARATOR};">|</span>&nbsp;&nbsp; `);
}

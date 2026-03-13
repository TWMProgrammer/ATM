import * as assert from 'assert';
import { QuotaManager } from '../extensions/ai-data-id/core/quota-manager';
import { getStatusColor, generateModernBar } from '../extensions/ai-data-id/ui/tooltip-builder';

suite('AI Data Extension – Unit Tests', () => {

	// ── QuotaManager.formatTime ──────────────────────────────────────

	suite('QuotaManager.formatTime', () => {
		test('returns "Ready" for zero or negative values', () => {
			assert.strictEqual(QuotaManager.formatTime(0), 'Ready');
			assert.strictEqual(QuotaManager.formatTime(-1000), 'Ready');
			assert.strictEqual(QuotaManager.formatTime(-999999), 'Ready');
		});

		test('formats minutes correctly (< 60 min)', () => {
			assert.strictEqual(QuotaManager.formatTime(60_000), '1m');     // 1 min
			assert.strictEqual(QuotaManager.formatTime(300_000), '5m');    // 5 min
			assert.strictEqual(QuotaManager.formatTime(3_540_000), '59m'); // 59 min
		});

		test('formats hours and minutes correctly', () => {
			assert.strictEqual(QuotaManager.formatTime(3_600_000), '1h 0m');      // 1h exactly
			assert.strictEqual(QuotaManager.formatTime(5_400_000), '1h 30m');     // 1h 30m
			assert.strictEqual(QuotaManager.formatTime(82_800_000), '23h 0m');    // 23h
		});

		test('formats days and hours for ≥ 24h', () => {
			assert.strictEqual(QuotaManager.formatTime(86_400_000), '1d 0h');     // 24h exactly
			assert.strictEqual(QuotaManager.formatTime(90_000_000), '1d 1h');     // 25h
			assert.strictEqual(QuotaManager.formatTime(172_800_000), '2d 0h');    // 48h exactly
		});

		test('rounds up partial minutes', () => {
			// 30 seconds → should round up to 1m
			assert.strictEqual(QuotaManager.formatTime(30_000), '1m');
			// 61 seconds → should round up to 2m
			assert.strictEqual(QuotaManager.formatTime(61_000), '2m');
		});
	});

	// ── getStatusColor ───────────────────────────────────────────────

	suite('getStatusColor', () => {
		test('returns red for danger zone (< 15%)', () => {
			assert.strictEqual(getStatusColor(0), '#f87171');
			assert.strictEqual(getStatusColor(14), '#f87171');
		});

		test('returns yellow for warning zone (15–39%)', () => {
			assert.strictEqual(getStatusColor(15), '#facc15');
			assert.strictEqual(getStatusColor(39), '#facc15');
		});

		test('returns cyan for info zone (40–69%)', () => {
			assert.strictEqual(getStatusColor(40), '#22d3ee');
			assert.strictEqual(getStatusColor(69), '#22d3ee');
		});

		test('returns green for healthy zone (≥ 70%)', () => {
			assert.strictEqual(getStatusColor(70), '#4ade80');
			assert.strictEqual(getStatusColor(100), '#4ade80');
		});
	});

	// ── generateModernBar ────────────────────────────────────────────

	suite('generateModernBar', () => {
		test('generates a bar with 15 segments', () => {
			const bar = generateModernBar(50, '#4ade80');
			// Count the number of ● characters
			const dots = (bar.match(/●/g) || []).length;
			assert.strictEqual(dots, 15);
		});

		test('generates all unfilled dots for 0%', () => {
			const bar = generateModernBar(0, '#f87171');
			// All dots should use the unfilled color
			assert.ok(!bar.includes('#f87171'), 'Should not contain the filled color');
		});

		test('generates all filled dots for 100%', () => {
			const bar = generateModernBar(100, '#4ade80');
			// All dots should use the base color with alpha
			assert.ok(bar.includes('#4ade80'), 'Should contain the filled color');
			assert.ok(!bar.includes('#ffffff0f'), 'Should not contain the unfilled color');
		});

		test('returns a non-empty string', () => {
			const bar = generateModernBar(42, '#22d3ee');
			assert.ok(bar.length > 0);
		});
	});
});

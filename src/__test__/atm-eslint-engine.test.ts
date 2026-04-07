import * as assert from 'assert';
import { suite, test } from 'mocha';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { EslintEngine } from '../extensions/atm-eslint/server/engine';

type EngineTestInternals = {
	lastReportedMessages: Map<string, any[]>;
	lastDocumentText: Map<string, string>;
};

function seedEngine(engine: EslintEngine, uri: string, text: string, messages: any[]): void {
	const internals = engine as unknown as EngineTestInternals;
	internals.lastReportedMessages.set(uri, messages);
	internals.lastDocumentText.set(uri, text);
}

suite('ATM ESLint Engine - Quick Fixes', () => {
	test('returns eqeqeq suggestion quick fix when suggestions are enabled', () => {
		const engine = new EslintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (a == b) {\n  console.log(a);\n}\n';

		seedEngine(engine, uri, text, [{
			ruleId: 'eqeqeq',
			message: "Expected '===' and instead saw '=='.",
			line: 1,
			column: 7,
			endLine: 1,
			endColumn: 9,
			severity: 2,
			suggestions: [{
				desc: "Use '===' instead of '=='.",
				fix: {
					range: [6, 8],
					text: '==='
				}
			}]
		}]);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 6 },
				end: { line: 0, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'ESLint (ATM)',
			code: 'eqeqeq'
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: true });
		assert.strictEqual(actions.length, 1);
		assert.strictEqual(actions[0].title, "ESLint: Use '===' instead of '=='. (eqeqeq)");

		const edit = actions[0].edit?.changes?.[uri]?.[0];
		assert.ok(edit);
		assert.strictEqual(edit?.newText, '===');
		assert.deepStrictEqual(edit?.range, {
			start: { line: 0, character: 6 },
			end: { line: 0, character: 8 }
		});
	});

	test('skips eqeqeq suggestion quick fix when suggestions are disabled', () => {
		const engine = new EslintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (a == b) {\n  console.log(a);\n}\n';

		seedEngine(engine, uri, text, [{
			ruleId: 'eqeqeq',
			message: "Expected '===' and instead saw '=='.",
			line: 1,
			column: 7,
			endLine: 1,
			endColumn: 9,
			severity: 2,
			suggestions: [{
				desc: "Use '===' instead of '=='.",
				fix: {
					range: [6, 8],
					text: '==='
				}
			}]
		}]);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 6 },
				end: { line: 0, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'ESLint (ATM)',
			code: 'eqeqeq'
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: false });
		assert.strictEqual(actions.length, 0);
	});

	test('keeps direct fixes available when suggestions are disabled', () => {
		const engine = new EslintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'const value = 1\n';

		seedEngine(engine, uri, text, [{
			ruleId: 'semi',
			message: 'Missing semicolon.',
			line: 1,
			column: 16,
			endLine: 1,
			endColumn: 16,
			severity: 2,
			fix: {
				range: [15, 15],
				text: ';'
			}
		}]);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 15 },
				end: { line: 0, character: 15 }
			},
			message: 'Missing semicolon. (semi)',
			severity: DiagnosticSeverity.Warning,
			source: 'ESLint (ATM)',
			code: 'semi'
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: false });
		assert.strictEqual(actions.length, 1);
		assert.strictEqual(actions[0].title, 'ESLint: Apply auto-fix (semi)');

		const edit = actions[0].edit?.changes?.[uri]?.[0];
		assert.ok(edit);
		assert.strictEqual(edit?.newText, ';');
	});

	test('maps suggestion offsets correctly for CRLF documents', () => {
		const engine = new EslintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (x === y) {\r\nif (a == b) {\r\n}\r\n';
		const secondEqeqOffset = text.lastIndexOf('==');

		seedEngine(engine, uri, text, [{
			ruleId: 'eqeqeq',
			message: "Expected '===' and instead saw '=='.",
			line: 2,
			column: 7,
			endLine: 2,
			endColumn: 9,
			severity: 2,
			suggestions: [{
				desc: "Use '===' instead of '=='.",
				fix: {
					range: [secondEqeqOffset, secondEqeqOffset + 2],
					text: '==='
				}
			}]
		}]);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 1, character: 6 },
				end: { line: 1, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'ESLint (ATM)',
			code: 'eqeqeq'
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: true });
		assert.strictEqual(actions.length, 1);

		const edit = actions[0].edit?.changes?.[uri]?.[0];
		assert.ok(edit);
		assert.deepStrictEqual(edit?.range, {
			start: { line: 1, character: 6 },
			end: { line: 1, character: 8 }
		});
		assert.strictEqual(edit?.newText, '===');
	});
});

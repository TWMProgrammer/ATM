import * as assert from 'assert';
import { suite, test } from 'mocha';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { LintEngine } from '../extensions/atm-lint/server/engine';

function seedEngine(engine: LintEngine, uri: string, text: string, version: number = 1): void {
	const internals = engine as any;
	internals.documentVersion.set(uri, version);
	internals.lastDocumentText.set(uri, text);
}

suite('ATM Lint Engine - Quick Fixes', () => {
	test('filters non-code "file ignored" warnings from ESLint internals', () => {
		const engine = new LintEngine(() => undefined);
		const internals = engine as any;

		const ignoredByConfigMessage = {
			message: 'File ignored because no matching configuration was supplied.',
			ruleId: null
		};

		const ignoredByPatternMessage = {
			message: 'File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning.',
			ruleId: null
		};

		assert.strictEqual(internals.isNonCodeEslintMessage(ignoredByConfigMessage), true);
		assert.strictEqual(internals.isNonCodeEslintMessage(ignoredByPatternMessage), true);
	});

	test('keeps parser and rule diagnostics that represent real code issues', () => {
		const engine = new LintEngine(() => undefined);
		const internals = engine as any;

		const parserErrorMessage = {
			message: 'Parsing error: Unexpected token <',
			ruleId: null
		};

		const ruleMessage = {
			message: 'Missing semicolon.',
			ruleId: 'semi'
		};

		assert.strictEqual(internals.isNonCodeEslintMessage(parserErrorMessage), false);
		assert.strictEqual(internals.isNonCodeEslintMessage(ruleMessage), false);
	});

	test('returns eqeqeq suggestion quick fix when suggestions are enabled', () => {
		const engine = new LintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (a == b) {\n  console.log(a);\n}\n';

		seedEngine(engine, uri, text, 1);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 6 },
				end: { line: 0, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'Lint (ATM)',
			code: 'eqeqeq',
			data: {
				textVersion: 1,
				suggestions: [{
					desc: "Use '===' instead of '=='.",
					fix: {
						range: [6, 8],
						text: '==='
					}
				}]
			}
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: true });
		assert.strictEqual(actions.length, 1);
		assert.strictEqual(actions[0].title, "Lint [✨]: Use '===' instead of '=='. (eqeqeq)");

		const edit = actions[0].edit?.changes?.[uri]?.[0];
		assert.ok(edit);
		assert.strictEqual(edit?.newText, '===');
		assert.deepStrictEqual(edit?.range, {
			start: { line: 0, character: 6 },
			end: { line: 0, character: 8 }
		});
	});

	test('skips eqeqeq suggestion quick fix when suggestions are disabled', () => {
		const engine = new LintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (a == b) {\n  console.log(a);\n}\n';

		seedEngine(engine, uri, text, 1);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 6 },
				end: { line: 0, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'Lint (ATM)',
			code: 'eqeqeq',
			data: {
				textVersion: 1,
				suggestions: [{
					desc: "Use '===' instead of '=='.",
					fix: {
						range: [6, 8],
						text: '==='
					}
				}]
			}
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: false });
		assert.strictEqual(actions.length, 0);
	});

	test('keeps direct fixes available when suggestions are disabled', () => {
		const engine = new LintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'const value = 1\n';

		seedEngine(engine, uri, text, 1);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 0, character: 15 },
				end: { line: 0, character: 15 }
			},
			message: 'Missing semicolon. (semi)',
			severity: DiagnosticSeverity.Warning,
			source: 'Lint (ATM)',
			code: 'semi',
			data: {
				textVersion: 1,
				fix: {
					range: [15, 15],
					text: ';'
				}
			}
		};

		const actions = engine.getCodeActions(uri, diagnostic, { includeSuggestions: false });
		assert.strictEqual(actions.length, 1);
		assert.strictEqual(actions[0].title, 'Lint [🎨]: Apply auto-fix (semi)');

		const edit = actions[0].edit?.changes?.[uri]?.[0];
		assert.ok(edit);
		assert.strictEqual(edit?.newText, ';');
	});

	test('maps suggestion offsets correctly for CRLF documents', () => {
		const engine = new LintEngine(() => undefined);
		const uri = 'file:///tmp/test.ts';
		const text = 'if (x === y) {\r\nif (a == b) {\r\n}\r\n';
		const secondEqeqOffset = text.lastIndexOf('==');

		seedEngine(engine, uri, text, 1);

		const diagnostic: Diagnostic = {
			range: {
				start: { line: 1, character: 6 },
				end: { line: 1, character: 8 }
			},
			message: "Expected '===' and instead saw '=='. (eqeqeq)",
			severity: DiagnosticSeverity.Warning,
			source: 'Lint (ATM)',
			code: 'eqeqeq',
			data: {
				textVersion: 1,
				suggestions: [{
					desc: "Use '===' instead of '=='.",
					fix: {
						range: [secondEqeqOffset, secondEqeqOffset + 2],
						text: '==='
					}
				}]
			}
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

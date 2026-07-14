import * as assert from 'assert';
import type * as vscode from 'vscode';
import {
	getBestEmojiForCommit,
	type CommitChange,
} from '../extensions/29-commit-emoji/core/autoEmoji';

const context = {
	globalState: {
		get: () => ({}),
	},
} as unknown as vscode.ExtensionContext;

function change(path: string, isNew = false): CommitChange {
	return { path, isNew };
}

function getCode(message: string, changes: CommitChange[]): string | undefined {
	return getBestEmojiForCommit(message, context, [], changes)?.code;
}

suite('Commit Emoji auto assignment', () => {
	test('uses a seedling for a version release that updates release metadata', () => {
		assert.strictEqual(
			getCode('release version 2.1.0', [change('package.json'), change('CHANGELOG.md')]),
			':seedling:',
		);
	});

	test('uses a unicorn for a new nested project', () => {
		assert.strictEqual(
			getCode('add dashboard module', [change('apps/dashboard/package.json', true), change('apps/dashboard/index.ts', true)]),
			':unicorn:',
		);
	});

	test('uses a soccer ball when a project or milestone is finished', () => {
		assert.strictEqual(getCode('finish the dashboard milestone', [change('src/dashboard.ts')]), ':soccer:');
	});

	test('uses construction for newly added files', () => {
		assert.strictEqual(getCode('add formatter rule', [change('src/rules.ts', true)]), ':building_construction:');
	});

	test('uses tools for edits spanning more than two files', () => {
		assert.strictEqual(
			getCode('adjust lint rules', [change('a.ts'), change('b.ts'), change('c.ts')]),
			':hammer_and_wrench:',
		);
	});

	test('uses a wrench for a single-file edit and as the neutral fallback', () => {
		assert.strictEqual(getCode('adjust lint rule', [change('src/rules.ts')]), ':wrench:');
		assert.strictEqual(getCode('', []), ':wrench:');
	});
});

import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readHeadFile } from '../extensions/30-before-after/core/git';
import { findBeforeSelection } from '../extensions/30-before-after/core/selection';

function runGit(cwd: string, args: string[]): void {
	execFileSync('git', args, { cwd, stdio: 'pipe' });
}

suite('Before & After', () => {
	let tempDir: string;

	setup(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-before-after-'));
	});

	teardown(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('returns the committed file content', async () => {
		const filePath = path.join(tempDir, 'example.ts');
		runGit(tempDir, ['init']);
		runGit(tempDir, ['config', 'user.name', 'ATM Tests']);
		runGit(tempDir, ['config', 'user.email', 'atm@example.test']);
		fs.writeFileSync(filePath, 'const value = "before";\n');
		runGit(tempDir, ['add', 'example.ts']);
		runGit(tempDir, ['commit', '-m', 'initial']);
		fs.writeFileSync(filePath, 'const value = "after";\n');

		const result = await readHeadFile(filePath);

		assert.deepStrictEqual(result, { status: 'ok', content: 'const value = "before";\n' });
	});

	test('reports files without a Git baseline', async () => {
		const filePath = path.join(tempDir, 'untracked.ts');
		fs.writeFileSync(filePath, 'const value = true;\n');
		runGit(tempDir, ['init']);

		assert.deepStrictEqual(await readHeadFile(filePath), { status: 'no-baseline' });
	});

	test('reports files outside a Git repository', async () => {
		const filePath = path.join(tempDir, 'example.ts');
		fs.writeFileSync(filePath, 'const value = true;\n');

		assert.deepStrictEqual(await readHeadFile(filePath), { status: 'no-repository' });
	});

	test('maps a selected changed line to its previous line', () => {
		const before = '.box {\n\tposition: relative;\n\tborder: 1px solid;\n\tmargin: 10px;\n}\n';
		const current = '.box {\n\tposition: absolute;\n\tborder: 2px solid;\n\tmargin: 30px;\n}\n';

		const result = findBeforeSelection(before, current, {
			start: { line: 2, character: 0 },
			end: { line: 2, character: '\tborder: 2px solid;'.length }
		});

		assert.deepStrictEqual(result, { status: 'changed', beforeText: '\tborder: 1px solid;' });
	});

	test('maps only the selected value inside a changed line', () => {
		const before = '\tborder-radius: 8px;\n';
		const current = '\tborder-radius: 20px;\n';

		const result = findBeforeSelection(before, current, {
			start: { line: 0, character: 16 },
			end: { line: 0, character: 20 }
		});

		assert.deepStrictEqual(result, { status: 'changed', beforeText: '8px' });
	});

	test('maps only a selected multiline change block', () => {
		const before = '.box {\n\tposition: relative;\n\tmargin: 10px;\n\twidth: 100%;\n}\nfooter {}\n';
		const current = '.box {\n\tposition: absolute;\n\tmargin: 30px;\n\twidth: 20%;\n}\nfooter {}\n';

		const result = findBeforeSelection(before, current, {
			start: { line: 1, character: 0 },
			end: { line: 4, character: 0 }
		});

		assert.deepStrictEqual(result, {
			status: 'changed',
			beforeText: '\tposition: relative;\n\tmargin: 10px;\n\twidth: 100%;\n'
		});
	});

	test('returns an empty baseline for newly added selected code', () => {
		const before = 'first\nlast\n';
		const current = 'first\nadded\nlast\n';

		const result = findBeforeSelection(before, current, {
			start: { line: 1, character: 0 },
			end: { line: 1, character: 5 }
		});

		assert.deepStrictEqual(result, { status: 'changed', beforeText: '' });
	});

	test('ignores an unchanged selection when the file changed elsewhere', () => {
		const before = 'same\nbefore\n';
		const current = 'same\nafter\n';

		const result = findBeforeSelection(before, current, {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 4 }
		});

		assert.deepStrictEqual(result, { status: 'unchanged' });
	});
});

import * as assert from 'assert';
import { canUpdateVersionString, getVersionStatus } from '../extensions/19-version-package/core/versionStatus';

suite('Version Package', () => {
	test('recognizes a range that already accepts latest', () => {
		const status = getVersionStatus('^5.8.0', { latest: '5.9.3', satisfies: '5.9.3', error: false });
		assert.strictEqual(status.kind, 'latest');
	});

	test('separates major upgrades from safe updates', () => {
		const status = getVersionStatus('^5.8.0', { latest: '7.0.2', satisfies: '5.9.3', error: false });
		assert.strictEqual(status.kind, 'major');
		assert.strictEqual(status.target, '7.0.2');
		assert.strictEqual(status.safeTarget, '5.9.3');
	});

	test('does not bulk-update a major-only upgrade', () => {
		const status = getVersionStatus('^5.9.3', { latest: '7.0.2', satisfies: '5.9.3', error: false });
		assert.strictEqual(status.kind, 'major');
		assert.strictEqual(status.safeTarget, null);
	});

	test('treats zero-major minor upgrades as potentially breaking', () => {
		const status = getVersionStatus('^0.2.1', { latest: '0.3.0', satisfies: '0.2.9', error: false });
		assert.strictEqual(status.kind, 'breaking');
		assert.strictEqual(status.safeTarget, '0.2.9');
	});

	test('updates only simple version strings', () => {
		assert.strictEqual(canUpdateVersionString('^5.9.3'), true);
		assert.strictEqual(canUpdateVersionString('~1.2.3-beta.1'), true);
		assert.strictEqual(canUpdateVersionString('>=1 <3'), false);
		assert.strictEqual(canUpdateVersionString('workspace:^'), false);
	});
});

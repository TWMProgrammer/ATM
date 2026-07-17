import * as assert from 'assert';
import { ReleaseStartLock } from '../extensions/24-npm-run/core/release-lock';

suite('NPM Run release lock', () => {
    test('rejects a second release start until the first has finished', () => {
        const lock = new ReleaseStartLock();

        assert.strictEqual(lock.tryAcquire(), true);
        assert.strictEqual(lock.tryAcquire(), false);

        lock.release();

        assert.strictEqual(lock.tryAcquire(), true);
    });
});

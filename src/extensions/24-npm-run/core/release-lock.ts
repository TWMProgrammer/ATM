/** Prevents a second release command from entering the async readiness check. */
export class ReleaseStartLock {
    private locked = false;

    tryAcquire(): boolean {
        if (this.locked) {
            return false;
        }
        this.locked = true;
        return true;
    }

    release(): void {
        this.locked = false;
    }
}

import * as crypto from 'crypto';
import * as path from 'path';

// ── Exclusion filter for mini-panel ──────────────────────────────────────────
// Files/folders where git blame is wasteful or meaningless.

const IGNORED_FOLDERS = new Set([
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.output',
    '.svelte-kit',
    '.angular',
    '.vite',
    '.turbo',
    '.cache',
    '.parcel-cache',
    'coverage',
    '__pycache__',
    '.dart_tool',
    '.flutter-plugins',
    '.pub-cache',
    '.gradle',
    '.idea',
    'vendor',
]);

const IGNORED_FILENAMES = new Set([
    'package-lock.json',
    'bun.lock',
    'bun.lockb',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'gemfile.lock',
    'cargo.lock',
    'poetry.lock',
    'pipfile.lock',
    'go.sum',
    'pubspec.lock',
    '.ds_store',
    'thumbs.db',
]);

const IGNORED_EXTENSIONS = new Set([
    // Minified / generated
    '.map',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
    // Fonts
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // Audio / Video
    '.mp3', '.mp4', '.wav', '.ogg', '.webm',
    // Archives
    '.zip', '.tar', '.gz', '.rar', '.7z',
    // Documents & binaries
    '.pdf', '.exe', '.dll', '.so', '.dylib', '.wasm',
]);

/**
 * Returns `true` if the file should be **excluded** from git blame processing.
 * Checks folder segments, exact filename, extension, and `.min.*` patterns.
 */
export function shouldIgnoreFile(fsPath: string): boolean {
    const segments = fsPath.split(path.sep);
    // Check folder segments
    for (const seg of segments) {
        if (IGNORED_FOLDERS.has(seg)) { return true; }
    }

    const basename = path.basename(fsPath).toLowerCase();

    // Exact filename match
    if (IGNORED_FILENAMES.has(basename)) { return true; }

    // .min.js / .min.css
    if (basename.endsWith('.min.js') || basename.endsWith('.min.css')) { return true; }

    // Extension match
    const ext = path.extname(basename);
    if (ext && IGNORED_EXTENSIONS.has(ext)) { return true; }

    return false;
}

export function timeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals: [number, string, string][] = [
        [31536000, 'year', 'years'],
        [2592000, 'month', 'months'],
        [86400, 'day', 'days'],
        [3600, 'hour', 'hours'],
        [60, 'minute', 'minutes'],
    ];
    for (const [sec, singular, plural] of intervals) {
        const count = Math.floor(seconds / sec);
        if (count >= 1) {
            return `${count} ${count === 1 ? singular : plural} ago`;
        }
    }
    return 'just now';
}

export function formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
    });
}

export function debounce<A extends unknown[]>(
    f: (...args: A) => void,
    delay: number
): ((...args: A) => void) & { cancel: () => void } {
    let timeoutId: NodeJS.Timeout | undefined;

    const debounced = (...args: A) => {
        if (timeoutId) { clearTimeout(timeoutId); }
        timeoutId = setTimeout(() => f(...args), delay);
    };

    debounced.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
    };

    return debounced;
}

export function getGravatarUrl(email: string, size: number = 24): string {
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=retro`;
}

/**
 * Simple LRU cache with a maximum capacity.
 * Evicts the least-recently-used entry when the limit is exceeded.
 */
export class LRUCache<K, V> {
    private map = new Map<K, V>();

    constructor(private readonly maxSize: number) {}

    get(key: K): V | undefined {
        const value = this.map.get(key);
        if (value !== undefined) {
            // Move to end (most-recently used)
            this.map.delete(key);
            this.map.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.maxSize) {
            // Delete oldest entry (first key)
            const firstKey = this.map.keys().next().value as K;
            if (firstKey !== undefined) {
                this.map.delete(firstKey);
            }
        }
        this.map.set(key, value);
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    delete(key: K): boolean {
        return this.map.delete(key);
    }

    clear(): void {
        this.map.clear();
    }

    get size(): number {
        return this.map.size;
    }
}

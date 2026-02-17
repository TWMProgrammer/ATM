import * as fs from 'fs';

/**
 * Returns a human-readable file size string (e.g. "12.5 KB").
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${i === 0 ? size : size.toFixed(1)} ${units[i]}`;
}

// ─── File-size cache (TTL: 10 s) ───────────────────────────────────

const FILE_SIZE_TTL = 10_000;
const fileSizeCache = new Map<string, { value: string | undefined; ts: number }>();

/**
 * Get file size as a formatted string (cached for 10 s).
 * Returns undefined for non-existent files.
 */
export async function getFileSize(filePath: string): Promise<string | undefined> {
  const now = Date.now();
  const cached = fileSizeCache.get(filePath);
  if (cached && now - cached.ts < FILE_SIZE_TTL) {
    return cached.value;
  }
  try {
    const stat = await fs.promises.stat(filePath);
    const value = formatFileSize(stat.size);
    fileSizeCache.set(filePath, { value, ts: now });
    return value;
  } catch {
    fileSizeCache.set(filePath, { value: undefined, ts: now });
    return undefined;
  }
}

/** Flush stale entries from the file-size cache. */
export function pruneFileSizeCache(): void {
  const now = Date.now();
  for (const [key, entry] of fileSizeCache) {
    if (now - entry.ts >= FILE_SIZE_TTL) { fileSizeCache.delete(key); }
  }
}

// ─── Resolution cache ───────────────────────────────────────────────

const RESOLVE_TTL = 30_000;
const resolveCache = new Map<string, { value: string | undefined; ts: number }>();

/** Cache a resolved path so we don't hit the FS again on every scan. */
export function getCachedResolution(cacheKey: string): string | undefined | null {
  const cached = resolveCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RESOLVE_TTL) { return cached.value; }
  return null; // null = not cached
}

export function setCachedResolution(cacheKey: string, value: string | undefined): void {
  resolveCache.set(cacheKey, { value, ts: Date.now() });
}

export function pruneResolveCache(): void {
  const now = Date.now();
  for (const [key, entry] of resolveCache) {
    if (now - entry.ts >= RESOLVE_TTL) { resolveCache.delete(key); }
  }
}

/** Whether the path is a local file (not a URL or data URI) */
export function isLocalFile(source: string): boolean {
  return !source.includes('://');
}

/** Whether the path is an inline data URI */
export function isDataUri(source: string): boolean {
  return source.startsWith('data:image');
}

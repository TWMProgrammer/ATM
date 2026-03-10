import * as fs from 'fs';
import sizeOf from 'image-size';

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

// =========================================================
// 💾 COMBINED IMAGE METADATA CACHE (TTL: 15s)
// =========================================================

export interface ImageMeta {
  fileSize?: string;
  dimensions?: string;
  format?: string;
}

const META_TTL = 15_000;
const IMAGE_HEADER_BYTES = 4096; // enough bytes for image-size to detect dimensions
const metaCache = new Map<string, { value: ImageMeta; ts: number }>();

/**
 * Get all image metadata in a single FS pass (cached for 15 s).
 * Reads only the file header for dimensions (not the entire file).
 */
export async function getImageMeta(filePath: string): Promise<ImageMeta> {
  const now = Date.now();
  const cached = metaCache.get(filePath);
  if (cached && now - cached.ts < META_TTL) { return cached.value; }

  const meta: ImageMeta = {};

  try {
    // Single FS call: open file descriptor
    const fd = await fs.promises.open(filePath, 'r');
    try {
      // File size from stat
      const stat = await fd.stat();
      meta.fileSize = formatFileSize(stat.size);

      // Read only header bytes for dimensions + format
      const headerSize = Math.min(IMAGE_HEADER_BYTES, stat.size);
      const buf = Buffer.alloc(headerSize);
      await fd.read(buf, 0, headerSize, 0);

      const result = sizeOf(new Uint8Array(buf));
      if (result.width && result.height) {
        meta.dimensions = `${result.width}x${result.height}`;
      }
      if (result.type) {
        meta.format = result.type.toUpperCase();
      }
    } finally {
      await fd.close();
    }
  } catch {
    // file doesn't exist or unreadable — return partial meta
  }

  metaCache.set(filePath, { value: meta, ts: now });
  return meta;
}

/** Flush stale entries from the metadata cache. */
export function pruneMetaCache(): void {
  const now = Date.now();
  for (const [key, entry] of metaCache) {
    if (now - entry.ts >= META_TTL) { metaCache.delete(key); }
  }
}

/** Invalidate a specific path from the metadata cache (e.g. on file save). */
export function invalidateMetaCache(filePath: string): void {
  metaCache.delete(filePath);
}

// =========================================================
// 🗺️ RESOLUTION CACHE
// =========================================================

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

/** Invalidate resolution entries that reference a specific file path. */
export function invalidateResolveCacheFor(filePath: string): void {
  for (const [key, entry] of resolveCache) {
    if (entry.value === filePath) { resolveCache.delete(key); }
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

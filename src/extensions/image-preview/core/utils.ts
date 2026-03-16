import * as fs from 'fs';
import sizeOf from 'image-size';
import { ACCEPTED_EXTENSIONS } from './types';

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

export interface ExplorerFileMeta {
  fileSize?: string;
  dimensions?: string;
  format?: string;
  additionalInfo?: string;
}

export type ImageMeta = ExplorerFileMeta;

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
// 🎬 QUICK MP4 DIMENSION READER
// =========================================================

export async function getMp4Dimensions(filePath: string): Promise<{ width: number; height: number } | undefined> {
  let fd: fs.promises.FileHandle | undefined;
  try {
    fd = await fs.promises.open(filePath, 'r');
    const stat = await fd.stat();
    if (stat.size < 8) {return undefined;}

    const buf = Buffer.alloc(8);
    let offset = 0;
    let iterations = 0;

    while (offset < stat.size && iterations < 1000) {
      iterations++;
      const { bytesRead } = await fd.read(buf, 0, 8, offset);
      if (bytesRead < 8) {break;}

      let size = Number(buf.readUInt32BE(0));
      const type = buf.toString('ascii', 4, 8);
      let headerSize = 8;

      if (size === 1) {
        const largeSizeBuf = Buffer.alloc(8);
        await fd.read(largeSizeBuf, 0, 8, offset + 8);
        size = Number(largeSizeBuf.readBigUInt64BE(0));
        headerSize = 16;
      } else if (size === 0) {
        size = stat.size - offset; // extends to end of file
      }

      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
        offset += headerSize; 
      } else if (type === 'tkhd') {
        const tkhdBuf = Buffer.alloc(100);
        const toRead = Math.min(100, stat.size - offset - headerSize);
        if (toRead >= 84) {
          await fd.read(tkhdBuf, 0, toRead, offset + headerSize);
          const version = tkhdBuf.readUInt8(0);
          const widthOffset = version === 1 ? 88 : 76;
          
          if (toRead >= widthOffset + 8) {
            const trackWidth = tkhdBuf.readUInt32BE(widthOffset) >> 16;
            const trackHeight = tkhdBuf.readUInt32BE(widthOffset + 4) >> 16;
            if (trackWidth > 0 && trackHeight > 0) {
              return { width: trackWidth, height: trackHeight };
            }
          }
        }
        offset += size; 
      } else {
        offset += size; 
      }
    }
  } catch {
    // ignore
  } finally {
    if (fd) {await fd.close();}
  }
  return undefined;
}

function getAspectRatioString(width: number, height: number): string {
  const ratio = width / height;
  const commonRatios = [
    { label: '16:9', val: 16 / 9 },
    { label: '4:3', val: 4 / 3 },
    { label: '21:9', val: 21 / 9 },
    { label: '9:16', val: 9 / 16 },
    { label: '1:1', val: 1 / 1 },
  ];
  for (const r of commonRatios) {
    if (Math.abs(ratio - r.val) < 0.05) {
      return r.label;
    }
  }
  return '';
}

export async function getExplorerFileMeta(filePath: string, extName: string): Promise<ExplorerFileMeta> {
  const now = Date.now();
  const cached = metaCache.get(filePath);
  if (cached && now - cached.ts < META_TTL) { return cached.value; }

  // If it's an image, defer to the full image parser
  if (ACCEPTED_EXTENSIONS.includes(extName)) {
    return getImageMeta(filePath);
  }

  const meta: ExplorerFileMeta = {};
  meta.format = extName.replace('.', '').toUpperCase();

  try {
    const stat = await fs.promises.stat(filePath);
    meta.fileSize = formatFileSize(stat.size);

    if (extName === '.mp4') {
      const dims = await getMp4Dimensions(filePath);
      if (dims) {
        meta.dimensions = `${dims.width}x${dims.height}`;
        const ar = getAspectRatioString(dims.width, dims.height);
        if (ar) {
          meta.additionalInfo = ar;
        }
      }
    }
  } catch {
    // ignore
  }

  metaCache.set(filePath, { value: meta, ts: now });
  return meta;
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

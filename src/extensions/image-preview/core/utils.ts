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

/**
 * Get file size as a formatted string. Returns undefined for non-existent files.
 */
export async function getFileSize(filePath: string): Promise<string | undefined> {
  try {
    const stat = await fs.promises.stat(filePath);
    return formatFileSize(stat.size);
  } catch {
    return undefined;
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

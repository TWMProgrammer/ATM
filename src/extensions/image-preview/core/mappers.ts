import * as path from 'path';
import * as fs from 'fs';
import type { UrlMapper } from './types';

// ─── Data URL Mapper ────────────────────────────────────────────────
// Resolves inline data:image URIs (already absolute)

const dataUrlMapper: UrlMapper = {
  map(_fileName, imagePath) {
    return imagePath.startsWith('data:image') ? imagePath : undefined;
  },
};

// ─── Simple / Absolute URL Mapper ───────────────────────────────────
// Handles http(s) URLs and absolute file paths

const simpleUrlMapper: UrlMapper = {
  map(_fileName, imagePath) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    if (imagePath.startsWith('//')) {
      return `https:${imagePath}`;
    }
    if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
      return imagePath;
    }
    return undefined;
  },
};

// ─── Relative to Open File Mapper ───────────────────────────────────
// Resolves paths relative to the currently open file

const relativeToFileMapper: UrlMapper = {
  map(fileName, imagePath) {
    const candidate = path.resolve(path.dirname(fileName), imagePath);
    return fs.existsSync(candidate) ? candidate : undefined;
  },
};

// ─── Relative to Workspace Root Mapper ──────────────────────────────
// Resolves paths relative to the workspace root

const relativeToWorkspaceMapper: UrlMapper = {
  map(_fileName, imagePath, workspaceFolder) {
    if (!workspaceFolder) { return undefined; }
    const candidate = path.resolve(workspaceFolder, imagePath);
    return fs.existsSync(candidate) ? candidate : undefined;
  },
};

// ─── Export mappers in resolution priority ──────────────────────────

export const mappers: UrlMapper[] = [
  dataUrlMapper,
  simpleUrlMapper,
  relativeToFileMapper,
  relativeToWorkspaceMapper,
];

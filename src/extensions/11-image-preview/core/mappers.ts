import * as path from 'path';
import * as fs from 'fs';
import type { UrlMapper } from './types';

// =========================================================
// 🖼️ DATA URL MAPPER
// Resolves inline data:image URIs (already absolute)
// =========================================================

const dataUrlMapper: UrlMapper = {
  async map(_fileName, imagePath) {
    return imagePath.startsWith('data:image') ? imagePath : undefined;
  },
};

// =========================================================
// 🌐 SIMPLE / ABSOLUTE URL MAPPER
// Handles http(s) URLs and absolute file paths
// =========================================================

const simpleUrlMapper: UrlMapper = {
  async map(_fileName, imagePath) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    if (imagePath.startsWith('//')) {
      return `https:${imagePath}`;
    }
    if (path.isAbsolute(imagePath)) {
      try {
        await fs.promises.access(imagePath);
        return imagePath;
      } catch {
        return undefined;
      }
    }
    return undefined;
  },
};

// =========================================================
// 📂 RELATIVE TO OPEN FILE MAPPER
// Resolves paths relative to the currently open file
// =========================================================

const relativeToFileMapper: UrlMapper = {
  async map(fileName, imagePath) {
    const candidate = path.resolve(path.dirname(fileName), imagePath);
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      return undefined;
    }
  },
};

// =========================================================
// 📁 RELATIVE TO WORKSPACE ROOT MAPPER
// Resolves paths relative to the workspace root
// =========================================================

const relativeToWorkspaceMapper: UrlMapper = {
  async map(_fileName, imagePath, workspaceFolder) {
    if (!workspaceFolder) { return undefined; }
    const candidate = path.resolve(workspaceFolder, imagePath);
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      return undefined;
    }
  },
};

// =========================================================
// 🚀 EXPORT MAPPERS IN RESOLUTION PRIORITY
// =========================================================

export const mappers: UrlMapper[] = [
  dataUrlMapper,
  simpleUrlMapper,
  relativeToFileMapper,
  relativeToWorkspaceMapper,
];

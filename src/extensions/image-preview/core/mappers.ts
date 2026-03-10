import * as path from 'path';
import * as fs from 'fs';
import type { UrlMapper } from './types';

// =========================================================
// 🖼️ DATA URL MAPPER
// Resolves inline data:image URIs (already absolute)
// =========================================================

const dataUrlMapper: UrlMapper = {
  map(_fileName, imagePath) {
    return imagePath.startsWith('data:image') ? imagePath : undefined;
  },
};

// =========================================================
// 🌐 SIMPLE / ABSOLUTE URL MAPPER
// Handles http(s) URLs and absolute file paths
// =========================================================

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

// =========================================================
// 📂 RELATIVE TO OPEN FILE MAPPER
// Resolves paths relative to the currently open file
// =========================================================

const relativeToFileMapper: UrlMapper = {
  map(fileName, imagePath) {
    const candidate = path.resolve(path.dirname(fileName), imagePath);
    return fs.existsSync(candidate) ? candidate : undefined;
  },
};

// =========================================================
// 📁 RELATIVE TO WORKSPACE ROOT MAPPER
// Resolves paths relative to the workspace root
// =========================================================

const relativeToWorkspaceMapper: UrlMapper = {
  map(_fileName, imagePath, workspaceFolder) {
    if (!workspaceFolder) { return undefined; }
    const candidate = path.resolve(workspaceFolder, imagePath);
    return fs.existsSync(candidate) ? candidate : undefined;
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

import type * as vscode from 'vscode';

/** Supported image file extensions */
export const ACCEPTED_EXTENSIONS = [
  '.svg', '.png', '.jpeg', '.jpg', '.bmp',
  '.gif', '.ico', '.webp', '.avif', '.jfif',
];

/** Explorer Sidebar Hover specific extensions */
export const EXPLORER_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];
export const EXPLORER_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
export const EXPLORER_FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'];

export const EXPLORER_ALL_EXTENSIONS = [
  ...ACCEPTED_EXTENSIONS,
  ...EXPLORER_VIDEO_EXTENSIONS,
  ...EXPLORER_AUDIO_EXTENSIONS,
  ...EXPLORER_FONT_EXTENSIONS
];

/** Result from a recognizer: a potential image URL found in a line */
export interface UrlMatch {
  url: string;
  lineIndex: number;
  start: number;
  end: number;
}

/** A recognizer scans a line of text and returns potential image URLs */
export interface Recognizer {
  recognize(lineIndex: number, line: string): UrlMatch[];
}

/** A mapper resolves a relative/partial image path to an absolute path */
export interface UrlMapper {
  map(fileName: string, imagePath: string, workspaceFolder?: string): string | undefined;
}

/** Resolved image information ready for decoration */
export interface ImageInfo {
  originalImagePath: string;
  imagePath: string;
  range: vscode.Range;
}

/** Decoration entry stored per document */
export interface DecorationEntry {
  cacheKey?: string;
  type: vscode.TextEditorDecorationType;
  decorations: vscode.DecorationOptions[];
  originalImagePath: string;
  imagePath: string;
}

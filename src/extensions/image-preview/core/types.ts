import type * as vscode from 'vscode';

/** Supported image file extensions */
export const ACCEPTED_EXTENSIONS = [
  '.svg', '.png', '.jpeg', '.jpg', '.bmp',
  '.gif', '.ico', '.webp', '.avif', '.jfif',
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
  type: vscode.TextEditorDecorationType;
  decorations: vscode.DecorationOptions[];
  originalImagePath: string;
  imagePath: string;
}

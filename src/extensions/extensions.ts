import type * as vscode from 'vscode';
import { activateImagePreview } from './image-preview';

/**
 * Register all sub-extensions here.
 * Each receives the shared ExtensionContext.
 */
export function activateExtensions(context: vscode.ExtensionContext): void {
  activateImagePreview(context);
}

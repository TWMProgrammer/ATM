import * as vscode from 'vscode';
import { activateBreadcrumbsSettings } from './breadcrumbs/breadcrumbs';
import { activateCursorSettings } from './cursor/cursor';
import { activateFilesSettings } from './files/files';

export async function activateNativeSettings(
  _context: vscode.ExtensionContext,
) {
  try {
    await activateBreadcrumbsSettings();
    await activateCursorSettings();
    await activateFilesSettings();
  } catch (error) {
    console.error('ATM Extension: Error activating native settings.', error);
  }
}

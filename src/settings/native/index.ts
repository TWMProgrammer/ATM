import * as vscode from 'vscode';
import { activateCursorSettings } from './cursor/cursor';

export async function activateNativeSettings(
  _context: vscode.ExtensionContext,
) {
  try {
    await activateCursorSettings();
  } catch (error) {
    console.error(
      'ATM Extension: Error activando las configuraciones nativas del cursor.',
      error,
    );
  }
}

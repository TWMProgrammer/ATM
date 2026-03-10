import * as vscode from 'vscode';
import { activateCursorSettings } from './cursor/cursor';

export function activateNativeSettings(context: vscode.ExtensionContext) {
  activateCursorSettings();
}

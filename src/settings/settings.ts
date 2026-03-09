import * as vscode from 'vscode';
import { activateCodeSettings, deactivateCodeSettings } from './code/code';

export function activateSettings(context: vscode.ExtensionContext) {
  activateCodeSettings(context);
}

export function deactivateSettings() {
  deactivateCodeSettings();
}

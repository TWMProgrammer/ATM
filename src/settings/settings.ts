import * as vscode from 'vscode';
import { activateCodeSettings, deactivateCodeSettings } from './code/code';
import { activateNativeSettings } from './native/native';

export function activateSettings(context: vscode.ExtensionContext) {
  activateCodeSettings(context);
  activateNativeSettings(context);
}

export function deactivateSettings() {
  deactivateCodeSettings();
}

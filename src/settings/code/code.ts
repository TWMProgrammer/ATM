import * as vscode from 'vscode';
import {
  activateAutoTagFeatures,
  deactivateAutoTagFeatures,
} from './auto-tag-x2';

export function activateCodeSettings(context: vscode.ExtensionContext) {
  activateAutoTagFeatures(context);
}

export function deactivateCodeSettings() {
  deactivateAutoTagFeatures();
}

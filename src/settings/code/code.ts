import * as vscode from 'vscode';
import {
  activateAutoTagFeatures,
  deactivateAutoTagFeatures,
} from './auto-tag-x2';
import { activateColorBgTag } from './color-bg-tag';

export function activateCodeSettings(context: vscode.ExtensionContext) {
  activateAutoTagFeatures(context);
  activateColorBgTag(context);
}

export function deactivateCodeSettings() {
  deactivateAutoTagFeatures();
}

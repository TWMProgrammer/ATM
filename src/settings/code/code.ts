import * as vscode from 'vscode';
import {
  activateAutoTagFeatures,
  deactivateAutoTagFeatures,
} from './auto-tag-x2';
import { activateColorBgTag, deactivateColorBgTag } from './color-bg-tag';
import { activateCopyTag, deactivateCopyTag } from './copy-tag';

export function activateCodeSettings(context: vscode.ExtensionContext) {
  activateAutoTagFeatures(context);
  activateColorBgTag(context);
  activateCopyTag(context);
}

export function deactivateCodeSettings() {
  deactivateAutoTagFeatures();
  deactivateColorBgTag();
  deactivateCopyTag();
}

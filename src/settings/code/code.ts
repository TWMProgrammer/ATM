import * as vscode from 'vscode';
import {
  activateAutoTagFeatures,
  deactivateAutoTagFeatures,
} from './auto-tag-x2';
import { activateColorBgTag, deactivateColorBgTag } from './color-bg-tag';
import { activateCopyTag, deactivateCopyTag } from './copy-tag';
import { activateLineBgTag, deactivateLineBgTag } from './line-bg-tag';

export function activateCodeSettings(context: vscode.ExtensionContext) {
  activateAutoTagFeatures(context);
  activateColorBgTag(context);
  activateCopyTag(context);
  activateLineBgTag(context);
}

export function deactivateCodeSettings() {
  deactivateAutoTagFeatures();
  deactivateColorBgTag();
  deactivateCopyTag();
  deactivateLineBgTag();
}

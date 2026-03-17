import type * as vscode from 'vscode';
import { activateImagePreview as _activateImagePreview } from './ui/decorator';
import { activateImageExplorerHover } from './hover';

export function activateImagePreview(context: vscode.ExtensionContext): void {
  _activateImagePreview(context);
  activateImageExplorerHover(context);
}

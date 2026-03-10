import * as vscode from 'vscode';

export function getCopyColors() {
  const c = vscode.workspace.getConfiguration('atm.copyTag');
  return {
    bg: c.get<string>('backgroundColor', '#00f0ace9'),
    fg: c.get<string | undefined>('foregroundColor', undefined),
  };
}

import * as vscode from 'vscode';

export function createDecorationStyles() {
  const errorOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff2a6d22',
      color: '#ff2a6d',
      margin: '0 0 0 16px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const warningOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022',
      color: '#ffb300',
      margin: '0 0 0 16px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  return {
    error: errorOptions,
    warning: warningOptions,
    dispose: () => {
      errorOptions.dispose();
      warningOptions.dispose();
    },
  };
}

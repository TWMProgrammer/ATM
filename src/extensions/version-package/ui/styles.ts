import * as vscode from 'vscode';

export function createDecorationStyles() {
  const updateAvailableOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022',
      color: '#ffb300',
      margin: '0 0 0 16px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 4px; padding: 2px 6px;',
    },
  });

  const upToDateOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#4caf5015',
      color: '#4caf50',
      margin: '0 0 0 16px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 4px; padding: 2px 6px; opacity: 0.8;',
    },
  });

  const loadingOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#8888881a',
      color: '#888888',
      margin: '0 0 0 16px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 4px; padding: 2px 6px;',
    },
  });

  return {
    updateAvailable: updateAvailableOptions,
    upToDate: upToDateOptions,
    loading: loadingOptions,
    dispose: () => {
      updateAvailableOptions.dispose();
      upToDateOptions.dispose();
      loadingOptions.dispose();
    },
  };
}

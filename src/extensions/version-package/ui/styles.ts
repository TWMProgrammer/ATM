import * as vscode from 'vscode';

export function createDecorationStyles() {
  const updateAvailableOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022',
      color: '#ffb300',
      margin: '0 0 0 21px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 4px; padding: 2px 6px;',
    },
  });

  const updateRecommendedOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#9ca3af33',
      color: '#e5e7eb',
      margin: '0 0 0 21px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 8px; padding: 2px 8px;',
    },
  });

  const upToDateOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#4caf5022',
      color: '#4caf50',
      margin: '0 0 0 21px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 12px; padding: 2px 8px;',
    },
  });

  const loadingOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#8888881a',
      color: '#888888',
      margin: '0 0 0 21px',
      textDecoration: 'none; font-family: monospace; font-size: 0.85em; border-radius: 4px; padding: 2px 6px;',
    },
  });

  return {
    updateAvailable: updateAvailableOptions,
    updateRecommended: updateRecommendedOptions,
    upToDate: upToDateOptions,
    loading: loadingOptions,
    dispose: () => {
      updateAvailableOptions.dispose();
      updateRecommendedOptions.dispose();
      upToDateOptions.dispose();
      loadingOptions.dispose();
    },
  };
}

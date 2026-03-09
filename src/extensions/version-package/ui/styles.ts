import * as vscode from 'vscode';

export function createDecorationStyles() {
  const updateAvailableOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022', // Naranja/Dorado translúcido
      color: '#ffb300', // Dorado
      margin: '0 0 0 30px',
      textDecoration:
        'none; font-size: 0.9em; border-radius: 6px; padding: 2px 8px; font-weight: normal; font-style: normal;',
    },
  });

  const upToDateOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#4caf5022', // Verde translúcido
      color: '#4caf50', // Verde
      margin: '0 0 0 30px',
      textDecoration:
        'none; font-size: 0.9em; border-radius: 6px; padding: 2px 8px; font-weight: normal; font-style: normal;',
    },
  });

  const loadingOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#88888822', // Gris translúcido
      color: '#888888', // Gris
      margin: '0 0 0 30px',
      textDecoration:
        'none; font-size: 0.9em; border-radius: 6px; padding: 2px 8px; font-weight: normal; font-style: normal;',
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

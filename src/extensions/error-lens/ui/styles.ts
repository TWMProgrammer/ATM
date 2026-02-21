import * as vscode from 'vscode';

export function createDecorationStyles() {
  const errorOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff2a6d22', // Fondo translúcido (22 en hex para opacidad baja)
      color: '#ff2a6d', // Fucsia vibrante para el texto
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const warningOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022', // Dorado/Naranja oscuro o translucido
      color: '#ffb300',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const infoOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#00bcd422', // Cian sutil
      color: '#00e5ff',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const hintOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#4caf5022', // Verde sutil
      color: '#69f0ae',
      margin: '0 0 0 20px',
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  return {
    error: errorOptions,
    warning: warningOptions,
    info: infoOptions,
    hint: hintOptions,
    dispose: () => {
      errorOptions.dispose();
      warningOptions.dispose();
      infoOptions.dispose();
      hintOptions.dispose();
    },
  };
}

import * as vscode from 'vscode';

export function createDecorationStyles() {
  const errorOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff2a6d22', // Fondo translúcido opacidad baja
      color: '#ff2a6d', // Fucsia vibrante
      margin: '0 0 0 40px', // Separación visual hacia la derecha, sin generar ghost-background
      textDecoration:
        'none; font-size: 0.95em; border-radius: 8px; padding: 3px 10px; font-weight: normal; font-style: normal;',
    },
  });

  const warningOptions = vscode.window.createTextEditorDecorationType({
    isWholeLine: false,
    after: {
      backgroundColor: '#ff980022', // Naranja/Dorado translúcido
      color: '#ffb300', // Amarillo oscuro/Dorado
      margin: '0 0 0 40px',
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

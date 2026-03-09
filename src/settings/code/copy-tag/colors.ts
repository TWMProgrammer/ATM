import * as vscode from 'vscode';

export function getCopyColors() {
  const config = vscode.workspace.getConfiguration('atm.copyTag');

  // Verde moderno "éxito" por defecto para transmitir que se copió correctamente
  const bg = config.get<string>(
    'backgroundColor',
    'rgba(34, 197, 94, 0.4)', // Verde translúcido vibrante
  );

  const fg = config.get<string | undefined>('foregroundColor');

  const border = config.get<string>(
    'borderColor',
    'rgba(34, 197, 94, 0.8)', // Verde esmeralda para el marco
  );

  return { bg, fg, border };
}

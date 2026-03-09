import * as vscode from 'vscode';

export const TRANSPARENT = '#00000000';

// ── Theme-Aware Colors ──────────────────────────────────────────────
export function getThemeColors(): { background: string; border: string } {
  const kind = vscode.window.activeColorTheme.kind;
  const isDark =
    kind === vscode.ColorThemeKind.Dark ||
    kind === vscode.ColorThemeKind.HighContrast;

  return {
    // Color azul oscuro similar a la captura, con un poco de transparencia
    background: isDark ? '#1a456b90' : '#8ab4f860',
    border: TRANSPARENT,
  };
}

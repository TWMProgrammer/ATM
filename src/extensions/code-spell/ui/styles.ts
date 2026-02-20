import * as vscode from 'vscode';

/**
 * Configure here the visual style of the spelling error indicator.
 * Instead of relying exclusively on the native VS Code theme (which is hard to change),
 * you can easily manipulate the visual output using standard CSS properties.
 *
 * Some examples:
 * - Green Wavy (Like image): 'underline wavy #10B981'
 * - Blue Wavy: 'underline wavy #3B82F6'
 * - Red Wavy: 'underline wavy #EF4444'
 * - Dashed Border: 'none; border-bottom: 2px dashed #10B981;'
 */
export const spellDecorationType = vscode.window.createTextEditorDecorationType(
  {
    textDecoration: 'underline wavy #06B6D4', // cyan / celeste like requested
  },
);

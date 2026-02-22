import * as vscode from 'vscode';

export class ColorBoxProvider implements vscode.DocumentColorProvider {
  // Regular expressions for colors
  private static HEX_REGEX =
    /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/gi;
  private static FLUTTER_REGEX = /0x([0-9a-fA-F]{8})\b/gi;
  private static RGB_REGEX =
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)/gi;
  private static BLOCK_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;

  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    // Exclude languages where VS Code natively supports Color Picker perfectly to avoid duplication.
    const excludedLanguages = [
      'css',
      'scss',
      'less',
      'html',
      'json',
      'jsonc',
      'yaml',
    ];
    if (excludedLanguages.includes(document.languageId)) {
      return [];
    }

    const text = document.getText();
    const colors: vscode.ColorInformation[] = [];

    // 1. Pre-calculate block comments to filter them out instantly
    const blockComments: { start: number; end: number }[] = [];
    let blockMatch;
    // Reset lastIndex just in case
    ColorBoxProvider.BLOCK_COMMENT_REGEX.lastIndex = 0;
    while (
      (blockMatch = ColorBoxProvider.BLOCK_COMMENT_REGEX.exec(text)) !== null
    ) {
      blockComments.push({
        start: blockMatch.index,
        end: blockMatch.index + blockMatch[0].length,
      });
    }

    // Helper: Check if an offset is inside a comment
    const isIgnored = (offset: number, length: number): boolean => {
      const startPos = document.positionAt(offset);
      const lineText = document.lineAt(startPos.line).text;

      // Check // line comments
      const textBeforeMatch = lineText.substring(0, startPos.character);
      if (textBeforeMatch.includes('//')) {
        return true;
      }

      // Check /* block comments */
      return blockComments.some(
        (block) => offset >= block.start && offset <= block.end,
      );
    };

    // 2. Parse Hex colors
    ColorBoxProvider.HEX_REGEX.lastIndex = 0;
    let match;
    while ((match = ColorBoxProvider.HEX_REGEX.exec(text)) !== null) {
      if (isIgnored(match.index, match[0].length)) {
        continue;
      }
      const parsed = this.parseHex(match[0]);
      if (parsed) {
        const range = new vscode.Range(
          document.positionAt(match.index),
          document.positionAt(match.index + match[0].length),
        );
        colors.push(new vscode.ColorInformation(range, parsed));
      }
    }

    // 3. Parse Flutter colors (0xAARRGGBB)
    ColorBoxProvider.FLUTTER_REGEX.lastIndex = 0;
    while ((match = ColorBoxProvider.FLUTTER_REGEX.exec(text)) !== null) {
      if (isIgnored(match.index, match[0].length)) {
        continue;
      }
      const parsed = this.parseFlutter(match[1]); // match[1] is the hex without 0x
      if (parsed) {
        const range = new vscode.Range(
          document.positionAt(match.index),
          document.positionAt(match.index + match[0].length),
        );
        colors.push(new vscode.ColorInformation(range, parsed));
      }
    }

    // 4. Parse RGB(A) colors
    ColorBoxProvider.RGB_REGEX.lastIndex = 0;
    while ((match = ColorBoxProvider.RGB_REGEX.exec(text)) !== null) {
      if (isIgnored(match.index, match[0].length)) {
        continue;
      }
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] ? parseFloat(match[4]) : 1;

      if (r <= 255 && g <= 255 && b <= 255 && a <= 1) {
        const range = new vscode.Range(
          document.positionAt(match.index),
          document.positionAt(match.index + match[0].length),
        );
        colors.push(
          new vscode.ColorInformation(
            range,
            new vscode.Color(r / 255, g / 255, b / 255, a),
          ),
        );
      }
    }

    return colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    const presentations: vscode.ColorPresentation[] = [];

    // Formatting utilities
    const toHex = (c: number) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0');
    const r = Math.round(color.red * 255);
    const g = Math.round(color.green * 255);
    const b = Math.round(color.blue * 255);
    const a = parseFloat(color.alpha.toFixed(2));

    const hexStr = `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
    const hexAStr = `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}${toHex(color.alpha)}`;

    // standard Hex
    presentations.push(
      new vscode.ColorPresentation(color.alpha === 1 ? hexStr : hexAStr),
    );

    // Flutter Hex (0xAARRGGBB)
    const flutterHex =
      `0x${toHex(color.alpha)}${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`.toUpperCase();
    presentations.push(new vscode.ColorPresentation(flutterHex));

    // RGB(A)
    const rgbStr =
      color.alpha === 1
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${a})`;
    presentations.push(new vscode.ColorPresentation(rgbStr));

    return presentations;
  }

  private parseHex(hex: string): vscode.Color | null {
    hex = hex.replace('#', '');
    let r = 0,
      g = 0,
      b = 0,
      a = 1;

    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
      if (hex.length === 4) {
        a = parseInt(hex[3] + hex[3], 16) / 255;
      }
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
      if (hex.length === 8) {
        a = parseInt(hex.substring(6, 8), 16) / 255;
      }
    } else {
      return null;
    }

    return new vscode.Color(r, g, b, a);
  }

  private parseFlutter(hexCode: string): vscode.Color | null {
    // Flutter is AARRGGBB
    if (hexCode.length !== 8) {
      return null;
    }
    const a = parseInt(hexCode.substring(0, 2), 16) / 255;
    const r = parseInt(hexCode.substring(2, 4), 16) / 255;
    const g = parseInt(hexCode.substring(4, 6), 16) / 255;
    const b = parseInt(hexCode.substring(6, 8), 16) / 255;

    return new vscode.Color(r, g, b, a);
  }
}

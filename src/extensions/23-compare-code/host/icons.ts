import * as vscode from 'vscode';

// ======================================
// WEBVIEW ICONS (HOST) | MARK: ICONS
// ======================================

/**
 * Resolves theme-aware SVG icon URIs from the module's own `assets/` folder and
 * keeps them in sync when the user switches color theme.
 */

const MODULE_SEGMENTS = ['src', 'extensions', '23-compare-code'] as const;

/** Icon file names (without extension) keyed by their template placeholder role. */
const ICON_NAMES = {
  warning: 'warning',
  play: 'play',
  stop: 'stop',
  panelLeft: 'panel-left',
  panelRight: 'panel-right',
  dualScroll: 'dual-scroll',
  earthCode: 'earth-code',
  language: 'language',
  onlyCode: 'only-code',
  switchOff: 'switch-off',
  switchOn: 'switch-on',
  clear: 'clear',
  copy: 'copy',
  download: 'download',
} as const;

export type IconSet = Record<keyof typeof ICON_NAMES, string>;

/** Map of HTML template placeholders to their icon key. */
const PLACEHOLDER_TO_KEY: Record<string, keyof typeof ICON_NAMES> = {
  WARNING_ICON: 'warning',
  PLAY_ICON: 'play',
  STOP_ICON: 'stop',
  PANEL_LEFT_ICON: 'panelLeft',
  PANEL_RIGHT_ICON: 'panelRight',
  DUAL_SCROLL_ICON: 'dualScroll',
  LANGUAGE_ICON: 'language',
  ONLY_CODE_ICON: 'onlyCode',
  SWITCH_ON_ICON: 'switchOn',
  SWITCH_OFF_ICON: 'switchOff',
  EARTH_CODE_ICON: 'earthCode',
  CLEAR_ICON_L: 'clear',
  CLEAR_ICON_R: 'clear',
  COPY_ICON_L: 'copy',
  COPY_ICON_R: 'copy',
  DOWNLOAD_ICON_L: 'download',
  DOWNLOAD_ICON_R: 'download',
};

export function getWebviewIcons(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): IconSet {
  const themeFolder =
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
      ? 'light'
      : 'dark';

  const toUri = (name: string): string =>
    webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          context.extensionUri,
          ...MODULE_SEGMENTS,
          'assets',
          'icons',
          themeFolder,
          `${name}.svg`
        )
      )
      .toString();

  const icons = {} as IconSet;
  for (const [key, fileName] of Object.entries(ICON_NAMES)) {
    icons[key as keyof IconSet] = toUri(fileName);
  }
  return icons;
}

/** Replace every `{{ICON}}` placeholder in the HTML with its resolved URI. */
export function replaceIconsInHtml(html: string, icons: IconSet): string {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (match, placeholder: string) => {
    const key = PLACEHOLDER_TO_KEY[placeholder];
    return key ? icons[key] : match;
  });
}

export interface DynamicIconManager {
  dispose(): void;
}

/** Re-post the icon set to the webview whenever the color theme changes. */
export function createDynamicIconManager(
  context: vscode.ExtensionContext,
  webview: vscode.Webview
): DynamicIconManager {
  const listener = vscode.window.onDidChangeActiveColorTheme(() => {
    webview.postMessage({
      command: 'updateIcons',
      icons: getWebviewIcons(context, webview),
    });
  });

  return { dispose: () => listener.dispose() };
}

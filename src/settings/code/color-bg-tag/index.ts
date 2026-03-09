import * as vscode from 'vscode';

// ── Constants ────────────────────────────────────────────────────────
const CONFIG_SECTION = 'atm';
const ENABLED_KEY = 'colorBgTag.enabled';
const COLOR_CUSTOMIZATIONS_KEY = 'workbench.colorCustomizations';

const MANAGED_KEYS = [
  'editor.wordHighlightBackground',
  'editor.wordHighlightBorder',
  'editor.wordHighlightStrongBackground',
  'editor.wordHighlightStrongBorder',
] as const;

const TRANSPARENT = '#00000000';

// ── Theme-Aware Colors ──────────────────────────────────────────────
function getThemeColors(): { background: string; border: string } {
  const kind = vscode.window.activeColorTheme.kind;
  const isDark =
    kind === vscode.ColorThemeKind.Dark ||
    kind === vscode.ColorThemeKind.HighContrast;

  return {
    background: isDark ? '#00a37557' : '#00875a40',
    border: TRANSPARENT,
  };
}

function buildColorMap(): Record<string, string> {
  const { background, border } = getThemeColors();
  return {
    [MANAGED_KEYS[0]]: background,
    [MANAGED_KEYS[1]]: border,
    [MANAGED_KEYS[2]]: background,
    [MANAGED_KEYS[3]]: border,
  };
}

// ── Core Logic ──────────────────────────────────────────────────────

/**
 * Injects managed colors into `workbench.colorCustomizations` (global scope).
 * Only writes if there is an actual diff to avoid unnecessary config churn.
 */
async function injectColors(): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const current =
    config.inspect<Record<string, string>>(COLOR_CUSTOMIZATIONS_KEY)
      ?.globalValue ?? {};

  const desired = buildColorMap();
  const merged = { ...current };
  let dirty = false;

  for (const [key, val] of Object.entries(desired)) {
    if (merged[key] !== val) {
      merged[key] = val;
      dirty = true;
    }
  }

  if (!dirty) {
    return;
  }

  try {
    await config.update(
      COLOR_CUSTOMIZATIONS_KEY,
      merged,
      vscode.ConfigurationTarget.Global,
    );
    console.log('ATM: Native Tag Colors — injected');
  } catch (err) {
    console.error('ATM: Failed to inject tag colors', err);
  }
}

/**
 * Removes only the keys managed by this module from `workbench.colorCustomizations`.
 * Preserves any user-defined or other extension colors.
 */
async function removeColors(): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const current =
    config.inspect<Record<string, string>>(COLOR_CUSTOMIZATIONS_KEY)
      ?.globalValue ?? {};

  const cleaned = { ...current };
  let dirty = false;

  for (const key of MANAGED_KEYS) {
    if (key in cleaned) {
      delete cleaned[key];
      dirty = true;
    }
  }

  if (!dirty) {
    return;
  }

  try {
    const value = Object.keys(cleaned).length > 0 ? cleaned : undefined;
    await config.update(
      COLOR_CUSTOMIZATIONS_KEY,
      value,
      vscode.ConfigurationTarget.Global,
    );
    console.log('ATM: Native Tag Colors — removed');
  } catch (err) {
    console.error('ATM: Failed to remove tag colors', err);
  }
}

function isEnabled(): boolean {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>(ENABLED_KEY, true);
}

// ── Public API ──────────────────────────────────────────────────────

export function activateColorBgTag(context: vscode.ExtensionContext): void {
  // Initial injection (if enabled)
  if (isEnabled()) {
    void injectColors();
  }

  // React to the user toggling the setting
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.${ENABLED_KEY}`)) {
        void (isEnabled() ? injectColors() : removeColors());
      }
    }),
  );

  // React to theme changes — re-inject with appropriate palette
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (isEnabled()) {
        void injectColors();
      }
    }),
  );
}

export function deactivateColorBgTag(): void {
  void removeColors();
}

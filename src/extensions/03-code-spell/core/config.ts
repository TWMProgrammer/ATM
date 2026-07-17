import * as vscode from 'vscode';

export const CODE_SPELL_CONFIG_SECTION = 'atm.codeSpell';
export const CODE_SPELL_ENABLED_KEY = 'enabled';

export function isCodeSpellEnabled(): boolean {
  return vscode.workspace
    .getConfiguration(CODE_SPELL_CONFIG_SECTION)
    .get<boolean>(CODE_SPELL_ENABLED_KEY, true);
}

export async function toggleCodeSpell(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration(CODE_SPELL_CONFIG_SECTION);
  const enabled = isCodeSpellEnabled();
  await config.update(
    CODE_SPELL_ENABLED_KEY,
    !enabled,
    vscode.ConfigurationTarget.Global,
  );
  return !enabled;
}

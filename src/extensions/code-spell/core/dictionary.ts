import { englishWords } from '../data/en-dict';
import { TECH_KEYWORDS } from '../data/tech-keywords';
import * as vscode from 'vscode';

// Main dictionary cache. Set offers O(1) complexity for fast lookup.
const dict = new Set<string>();

// Fast cache to avoid re-validating known valid words within the same session
const fastCache = new Set<string>();

/**
 * Initializes the extension dictionary with english words, technical
 * keywords, and user custom words from global state.
 */
export function initDictionary(context: vscode.ExtensionContext) {
  // 1. Load common english words
  for (const w of englishWords) {
    if (w) {
      dict.add(w.toLowerCase());
    }
  }

  // 2. Load cleaned technical keywords and extensions
  for (const w of TECH_KEYWORDS) {
    dict.add(w);
  }

  // 3. User custom words (Persistence and Settings)
  const legacyWords: string[] =
    context.globalState.get('atm.code-spell.customWords') || [];

  const config = vscode.workspace.getConfiguration('atm.codeSpell');
  const userWords = config.inspect<string[]>('customWords')?.globalValue || [];
  const workspaceWords =
    config.inspect<string[]>('customWords')?.workspaceValue || [];

  // Combine all customized vocab source arrays into memory cache
  for (const w of [...legacyWords, ...userWords, ...workspaceWords]) {
    if (w) {
      dict.add(w.toLowerCase().trim());
    }
  }

  console.log(
    `[Code-Spell] Dictionary Loaded! Total Words in memory: ${dict.size}`,
  );
}

/**
 * Adds a new word to the user's global settings.json
 */
export async function addWordToUserSettings(word: string): Promise<void> {
  const lower = word.toLowerCase().trim();
  if (!lower) {
    return;
  }

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  try {
    const config = vscode.workspace.getConfiguration('atm.codeSpell');
    const baseWords =
      config.inspect<string[]>('customWords')?.globalValue || [];
    const userWords = [...new Set([...baseWords, lower])]; // Deduplicate and include new word

    await config.update(
      'customWords',
      userWords,
      vscode.ConfigurationTarget.Global,
    );
  } catch (err) {
    console.error('[Code-Spell] Failed to save word to user settings:', err);
  }
}

/**
 * Adds a new word to the workspace's local .vscode/settings.json
 */
export async function addWordToWorkspaceSettings(word: string): Promise<void> {
  const lower = word.toLowerCase().trim();
  if (!lower) {
    return;
  }

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  try {
    const config = vscode.workspace.getConfiguration('atm.codeSpell');
    const baseWords =
      config.inspect<string[]>('customWords')?.workspaceValue || [];
    const workspaceWords = [...new Set([...baseWords, lower])]; // Deduplicate and include new word

    await config.update(
      'customWords',
      workspaceWords,
      vscode.ConfigurationTarget.Workspace,
    );
  } catch (err) {
    console.error(
      '[Code-Spell] Failed to save word to workspace settings:',
      err,
    );
  }
}

/**
* Highly optimized caching verification. O(1) lookup.
*/
export function isWordValid(word: string): boolean {
  const lower = word.toLowerCase();

  // 1. Check local fast-cache
  if (fastCache.has(lower)) {
    return true;
  }

  // 2. Check main dictionary
  let isValid = dict.has(lower);

  // 3. Smart fallback for plurals (ending in 's' or 'es')
  // Consumes no additional RAM and leverages the speed of slice()
  if (!isValid && lower.length > 3 && lower.endsWith('s')) {
    if (lower.endsWith('es')) {
      isValid = dict.has(lower.slice(0, -2)); // e.g. "branches" -> "branch"
    }
    if (!isValid) {
      isValid = dict.has(lower.slice(0, -1)); // e.g. "defaults" -> "default", "typings" -> "typing"
    }
  }

  // 4. Update local fast-cache
  // The fastCache will save the full plural ("typings") in memory so slice() is never repeated!
  if (isValid) {
    fastCache.add(lower);
  }

  return isValid;
}

/**
 * Returns dictionary array for Levenshtein calculations.
 */
export function getDictionaryWordsAsArray(): string[] {
  return Array.from(dict);
}

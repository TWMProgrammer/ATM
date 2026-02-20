import { englishWords } from '../data/en-dict';
import * as vscode from 'vscode';

// Main dictionary cache. Set offers O(1) complexity for fast lookup.
const dict = new Set<string>();

// Fast cache to avoid re-validating known valid words within the same session
const fastCache = new Set<string>();

// Technical parameters usually ignored by standard dictionaries
const programmingKeywords = [
  'function',
  'const',
  'let',
  'var',
  'import',
  'export',
  'return',
  'class',
  'interface',
  'type',
  'extends',
  'implements',
  'public',
  'private',
  'protected',
  'static',
  'async',
  'await',
  'fetch',
  'then',
  'catch',
  'console',
  'log',
  'error',
  'warn',
  'info',
  'typeof',
  'instanceof',
  'null',
  'undefined',
  'true',
  'false',
  'this',
  'super',
  'document',
  'window',
  'html',
  'css',
  'js',
  'ts',
  'json',
  'xml',
  'http',
  'https',
  'url',
  'uri',
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'body',
  'req',
  'res',
  'param',
  'params',
  'query',
  'config',
  'env',
  'src',
  'dist',
  'build',
  'app',
  'ui',
  'api',
  'db',
  'auth',
  'user',
  'id',
  'uuid',
  'guid',
  'obj',
  'arr',
  'str',
  'num',
  'bool',
  'regex',
  'regexp',
  'math',
  'date',
  'map',
  'set',
  'weak',
  'sym',
  'prop',
  'props',
  'state',
  'ctx',
  'context',
  'args',
  'arg',
  'val',
  'key',
  'idx',
  'index',
  'div',
  'span',
  'node',
  'elem',
  'element',
  'component',
  'module',
  'default',
  'require',
  'process',
  'vscode',
  'extension',
  'activate',
  'deactivate',
  'providers',
  'command',
  'diagnostics',
  'atm',
  'err',
  'msg',
  'out',
  'nav',
  'bar',
  'statusbar',
  'tsx',
  'jsx',
  'eslint',
  'prettier',
];

// Common file extensions that users might type
const commonExtensions = [
  'ts',
  'js',
  'html',
  'css',
  'scss',
  'json',
  'md',
  'txt',
  'png',
  'jpg',
  'svg',
];

/**
 * Initializes the extension dictionary with english words, technical
 * keywords, and user custom words from global state.
 */
export function initDictionary(context: vscode.ExtensionContext) {
  // 1. Load common words
  for (const w of englishWords) {
    if (w) {
      dict.add(w);
    }
  }

  // 2. Technical keywords
  for (const w of programmingKeywords) {
    dict.add(w);
  }

  for (const ext of commonExtensions) {
    dict.add(ext);
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
    dict.add(w.toLowerCase());
  }

  console.log(
    `[Code-Spell] Dictionary Loaded! Total Words in memory: ${dict.size}`,
  );
}

/**
 * Adds a new word to the user's global settings.json
 */
export function addWordToUserSettings(word: string) {
  const lower = word.toLowerCase();

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  const config = vscode.workspace.getConfiguration('atm.codeSpell');
  const userWords = config.inspect<string[]>('customWords')?.globalValue || [];
  if (!userWords.includes(lower)) {
    userWords.push(lower);
    config.update('customWords', userWords, vscode.ConfigurationTarget.Global);
  }
}

/**
 * Adds a new word to the workspace's local .vscode/settings.json
 */
export function addWordToWorkspaceSettings(word: string) {
  const lower = word.toLowerCase();

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  const config = vscode.workspace.getConfiguration('atm.codeSpell');
  const workspaceWords =
    config.inspect<string[]>('customWords')?.workspaceValue || [];
  if (!workspaceWords.includes(lower)) {
    workspaceWords.push(lower);
    config.update(
      'customWords',
      workspaceWords,
      vscode.ConfigurationTarget.Workspace,
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
  const isValid = dict.has(lower);

  // 3. Update local fast-cache
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

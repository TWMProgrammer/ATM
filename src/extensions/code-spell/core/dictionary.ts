import { englishWords } from '../data/en-dict';
import * as vscode from 'vscode';

// Main dictionary cache. Set offers O(1) complexity for fast lookup.
const dict = new Set<string>();

// Fast cache to avoid re-validating known valid words within the same session
const fastCache = new Set<string>();

// Technical parameters usually ignored by standard dictionaries
const programmingKeywords = [
  // --- ATM Words ---
  'antigravity',
  'windsurf',
  'trae',
  'gohit',
  'bastian',
  'xyz',
  'bastndev',
  'gohitx',
  'pls',
  
  // my words
  'todo',
  'fixme',
  'android',
  'ios',
  'flutter',
  'lint',
  'haptics',
  'lucide',
  'typescript',
  'dirname',
  'subgraph',
  'mermaid',
  'variants',
  'lr',
  'ail',
  'aig',
  'vsce',
  'readme',
  'nvim',
  'atm',
  'ai',
  'kiro',
  'ghibli',
  'favicon',
  'splash',
  'foreground',
  'monochrome',
  'dependencies',
  'slug',
  'woff',
  'git',
  'ass',
  'gesture',
  'handler',
  'reanimated',
  'worklets',

  // --- CSS Ecosystem and Web Tooling ---
  'tailwind',
  'tailwindcss',
  'postcss',
  'sass',
  'less',
  'clsx',
  'zod',
  'prisma',
  'trpc',
  'axios',
  'fetcher',

  // --- Modern concepts and modifiers (React/TS/Tech) ---
  'readonly',
  'unwind',
  'uniwind',
  'ssr',
  'ssg',
  'csr',
  'isr',
  'seo',
  'hydrate',
  'hydration',
  'prefetch',
  'preload',
  'memo',
  'memoize',
  'debounce',
  'throttle',
  'mount',
  'unmount',
  'render',
  'revalidate',
  'vdom',
  'bundler',

  // --- JavaScript / TypeScript ---
  'function',
  'warning',
  'info',
  'note',
  'hack',
  'tip',
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

  // --- Ecosistemas Modernos, Librerías y Frameworks ---
  'react',
  'vue',
  'angular',
  'svelte',
  'flutter',
  'lynx',
  'expo',
  'next',
  'nuxt',
  'vite',
  'webpack',
  'babel',
  'jest',
  'vitest',
  'supabase',
  'firebase',
  'astro',
  'remix',
  'gatsby',
  'qwik',
  'solid',
  'preact',
  'nest',
  'nestjs',
  'express',
  'fastify',
  'hono',
  'elysia',
  'deno',
  'bun',
  'ionic',
  'capacitor',
  'tauri',
  'electron',
  'graphql',
  'apollo',
  'relay',
  'redux',
  'zustand',
  'mobx',
  'pinia',
  'rxjs',

  // --- Common variable / folder names ---
  'config',
  'configs',
  'util',
  'utils',
  'component',
  'components',
  'screen',
  'screens',
  'layout',
  'layouts',
  'hook',
  'hooks',
  'service',
  'services',
  'helper',
  'helpers',
  'repo',
  'repos',
  'router',
  'routes',
  'middleware',
  'middlewares',
  'context',
  'contexts',
  'provider',
  'providers',
  'asset',
  'assets',
  'font',
  'fonts',
  'style',
  'styles',
  'theme',
  'themes',
  'color',
  'colors',
  'constant',
  'constants',
  'mock',
  'mocks',
  'test',
  'tests',
  'e2e',
  'type',
  'types',
  'interface',
  'interfaces',
  'enum',
  'enums',
  'global',
  'globals',
  'env',
  'envs',

  // -- HTML / Web Core adicionales --
  'div',
  'span',
  'href',
  'className',
  'style',
  'src',
  'alt',
  'width',
  'height',
  'svg',
  'path',
  'xmlns',
  'viewBox',
  'fill',
  'stroke',
  'bg',
  'fg',
  'btn',
  'nav',
  'doctype',
  'charset',
  'utf',
  'lang',
  'viewport',
  'initial',
  'scale',
  'head',
  'title',
  'body',
  'img',
  'header',
  'footer',
  'section',
  'article',
  'aside',
  'main',
  'figure',
  'figcaption',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'form',
  'input',
  'textarea',
  'button',
  'select',
  'option',
  'label',
  'fieldset',
  'legend',
  'iframe',
  'canvas',
  'audio',
  'video',
  'track',
  'embed',
  'object',
  'link',
  'script',
  'noscript',

  // -- Additional CSS Styles --
  'rgba',
  'hsla',
  'rem',
  'em',
  'vh',
  'vw',
  'calc',
  'linear',
  'radial',
  'gradient',
  'solid',
  'dashed',
  'dotted',
  'flexbox',
  'grid',
  'inline',
  'block',
  'absolute',
  'relative',
  'fixed',
  'sticky',
  'static',
  'auto',
  'hidden',
  'visible',
  'scroll',
  'overflow',
  'cursor',
  'opacity',
  'transition',
  'transform',
  'animation',
  'margin',
  'padding',
  'border',
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
export async function addWordToUserSettings(word: string) {
  const lower = word.toLowerCase();

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  const config = vscode.workspace.getConfiguration('atm.codeSpell');
  const baseWords = config.inspect<string[]>('customWords')?.globalValue || [];
  const userWords = [...baseWords]; // Clone to avoid modifying read-only array

  if (!userWords.includes(lower)) {
    userWords.push(lower);
    await config.update(
      'customWords',
      userWords,
      vscode.ConfigurationTarget.Global,
    );
  }
}

/**
 * Adds a new word to the workspace's local .vscode/settings.json
 */
export async function addWordToWorkspaceSettings(word: string) {
  const lower = word.toLowerCase();

  // Add to RAM memory
  dict.add(lower);
  fastCache.add(lower);

  // Save to persistence
  const config = vscode.workspace.getConfiguration('atm.codeSpell');
  const baseWords =
    config.inspect<string[]>('customWords')?.workspaceValue || [];
  const workspaceWords = [...baseWords]; // Clone to avoid modifying read-only array

  if (!workspaceWords.includes(lower)) {
    workspaceWords.push(lower);
    await config.update(
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

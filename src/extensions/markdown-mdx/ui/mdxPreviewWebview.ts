import * as React from 'react';
import { createRoot } from 'react-dom/client';

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
};

type RuntimeFactory = (runtime: {
  Fragment: typeof React.Fragment;
  jsx: (type: unknown, props: Record<string, unknown> | null, key?: string) => React.ReactElement;
  jsxs: (type: unknown, props: Record<string, unknown> | null, key?: string) => React.ReactElement;
}) => {
  default?: React.ComponentType;
};

type IncomingMessage =
  | { command: 'update'; code: string }
  | { command: 'error'; text: string };

const vscode = acquireVsCodeApi();
const rootNode = document.getElementById('root');
const errorNode = document.getElementById('error-overlay');

if (!rootNode || !errorNode) {
  throw new Error('MDX preview webview is missing required root elements.');
}

const rootEl: HTMLElement = rootNode;
const errEl: HTMLElement = errorNode;
const reactRoot = createRoot(rootEl);
type AsyncFunctionFactory = new (...args: string[]) => (...callArgs: unknown[]) => Promise<unknown>;
const AsyncFunctionCtor = Object.getPrototypeOf(async function () {}).constructor as AsyncFunctionFactory;

type ModuleLike = Record<string, unknown>;

function jsx(type: unknown, props: Record<string, unknown> | null, key?: string) {
  const nextProps = { ...(props || {}) };
  if (key !== undefined) {
    (nextProps as { key?: string }).key = key;
  }

  return React.createElement(type as React.ElementType, nextProps);
}

function jsxs(type: unknown, props: Record<string, unknown> | null, key?: string) {
  return jsx(type, props, key);
}

function showError(text: string) {
  rootEl.style.display = 'none';
  errEl.style.display = 'block';
  errEl.innerText = text;
}

function showPreview() {
  errEl.style.display = 'none';
  rootEl.style.display = 'block';
}

function patchCompiledCode(code: string): string {
  const normalized = code.replace(
    /await\s+import\(_resolveDynamicMdxSpecifier\((['"])([^'"]+)\1\)\)/g,
    'await __mdxImport($1$2$1)'
  );

  return `const __mdxImport = arguments[1];\n${normalized}`;
}

function clsx(...args: unknown[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) {
      continue;
    }
    if (typeof arg === 'string' || typeof arg === 'number') {
      out.push(String(arg));
      continue;
    }
    if (Array.isArray(arg)) {
      const value = clsx(...arg);
      if (value) {
        out.push(value);
      }
      continue;
    }
    if (typeof arg === 'object') {
      for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
        if (value) {
          out.push(key);
        }
      }
    }
  }
  return out.join(' ');
}

const reactModule: ModuleLike = {
  default: React,
  ...React
};

const jsxRuntimeModule: ModuleLike = {
  Fragment: React.Fragment,
  jsx,
  jsxs,
  jsxDEV: jsx
};

const supportedBareModules: Record<string, ModuleLike> = {
  react: reactModule,
  'react/jsx-runtime': jsxRuntimeModule,
  'react/jsx-dev-runtime': jsxRuntimeModule,
  clsx: { default: clsx, clsx },
  classnames: { default: clsx }
};

async function resolveMdxImport(specifier: string): Promise<ModuleLike> {
  const bare = supportedBareModules[specifier];
  if (bare) {
    return bare;
  }

  // Disallow network imports in preview runtime.
  if (/^https?:\/\//i.test(specifier)) {
    throw new Error(`Blocked network import in MDX preview: ${specifier}`);
  }

  // Allow local file-like specifiers to keep relative import compatibility.
  if (/^(file:|vscode-webview-resource:|vscode-resource:|\.|\/)/.test(specifier)) {
    return import(specifier) as Promise<ModuleLike>;
  }

  throw new Error(
    `Unsupported bare import in MDX preview: ${specifier}. ` +
      'Supported: react, react/jsx-runtime, react/jsx-dev-runtime, clsx, classnames.'
  );
}

window.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.command === 'update') {
    try {
      showPreview();

      const patchedCode = patchCompiledCode(message.code);
      const runTarget = new AsyncFunctionCtor(patchedCode);
      const executeMdx = await runTarget({ Fragment: React.Fragment, jsx, jsxs }, resolveMdxImport) as {
        default?: React.ComponentType;
      };
      const MDXContent = executeMdx?.default;

      if (typeof MDXContent === 'function') {
        reactRoot.render(React.createElement(MDXContent, {}));
      } else {
        throw new Error('No default export found from MDX evaluation.');
      }
    } catch (err) {
      const text = err instanceof Error ? err.stack || err.message : String(err);
      showError(text);
    }
    return;
  }

  if (message.command === 'error') {
    showError(message.text);
  }
});

vscode.postMessage({ command: 'ready' });

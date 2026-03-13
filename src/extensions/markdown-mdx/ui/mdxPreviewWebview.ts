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
  // MDX function-body emits `await import(_resolveDynamicMdxSpecifier('react'))`.
  // In webviews, bare specifiers are not resolved by default, so we map React imports
  // to the module already bundled with this script via `arguments[1]`.
  return code.replace(
    /await\s+import\(_resolveDynamicMdxSpecifier\((['"])react\1\)\)/g,
    'Promise.resolve(arguments[1])'
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
      const reactModule = {
        default: React,
        ...React
      };

      const runTarget = new AsyncFunctionCtor(patchedCode);
      const executeMdx = await runTarget({ Fragment: React.Fragment, jsx, jsxs }, reactModule) as {
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

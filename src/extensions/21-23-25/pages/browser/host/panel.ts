import * as crypto from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { PageClient } from '../core/cdp';
import {
  acquireBrowser,
  closePageTarget,
  createPageTarget,
  releaseBrowser,
} from '../core/launcher';
import { FromWebviewMessage, ToWebviewMessage } from './messages';

// ======================================
// ATM BROWSER — PANEL | MARK: PANEL
// ======================================

export const browserViewType = 'atm.browser';

const MODULE_SEGMENTS = ['src', 'extensions', '21-23-25', 'pages', 'browser'] as const;

const panels = new Set<BrowserPanel>();
let lastFocused: BrowserPanel | undefined;

function moduleUri(context: vscode.ExtensionContext, ...segments: string[]): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, ...MODULE_SEGMENTS, ...segments);
}

/** Reveal the last used browser tab, or open one if none exists. */
export function openBrowser(context: vscode.ExtensionContext, url?: string): void {
  if (lastFocused) {
    lastFocused.reveal();
    return;
  }
  newBrowserTab(context, url);
}

/** Always open an additional browser tab. */
export function newBrowserTab(context: vscode.ExtensionContext, url?: string): void {
  new BrowserPanel(context, url);
}

export function disposeAllBrowserPanels(): void {
  for (const panel of [...panels]) {
    panel.dispose();
  }
}

// ======================================
// CONFIG & URL RESOLUTION | MARK: CONFIG
// ======================================

interface BrowserConfig {
  executablePath: string;
  startUrl: string;
  searchEngine: string;
  quality: number;
}

function readConfig(): BrowserConfig {
  const cfg = vscode.workspace.getConfiguration('atm.browser');
  return {
    executablePath: cfg.get('executablePath', ''),
    startUrl: cfg.get('startUrl', ''),
    searchEngine: cfg.get('searchEngine', 'bing'),
    quality: Math.min(100, Math.max(10, cfg.get('quality', 80))),
  };
}

const SEARCH_URLS: Record<string, string> = {
  bing: 'https://www.bing.com/search?q=',
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
};

/** Turn URL-bar input into a navigable URL (or a search, like VS Code's browser). */
export function resolveInput(input: string, searchEngine: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return 'about:blank';
  }
  if (/^about:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }
  if (
    /^localhost(:\d+)?([/?#]|$)/i.test(trimmed) ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]|$)/.test(trimmed)
  ) {
    return 'http://' + trimmed;
  }
  if (!/\s/.test(trimmed) && /^[^\s/]+\.[^\s]{2,}/.test(trimmed)) {
    return 'https://' + trimmed;
  }
  const searchBase = SEARCH_URLS[searchEngine];
  if (searchBase) {
    return searchBase + encodeURIComponent(trimmed);
  }
  return 'https://' + trimmed;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

// ======================================
// BROWSER PANEL | MARK: BROWSER-PANEL
// ======================================

class BrowserPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private page: PageClient | undefined;
  private browserPort: number | undefined;
  private targetId: string | undefined;
  private acquired = false;
  private disposed = false;
  private currentUrl = 'about:blank';
  private pendingViewport: { width: number; height: number; dpr: number } | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly initialUrl?: string
  ) {
    this.panel = vscode.window.createWebviewPanel(
      browserViewType,
      'Browser',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          moduleUri(context, 'assets'),
        ],
      }
    );

    this.panel.iconPath = {
      light: moduleUri(context, 'assets', 'icons', 'light', 'browser.svg'),
      dark: moduleUri(context, 'assets', 'icons', 'dark', 'browser.svg'),
    };

    this.panel.webview.html = getWebviewHtml(context, this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (message: FromWebviewMessage) => void this.onMessage(message),
      undefined,
      this.disposables
    );

    this.panel.onDidChangeViewState(
      () => this.onViewStateChanged(),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.cleanup(), undefined, context.subscriptions);

    panels.add(this);
    lastFocused = this;
  }

  reveal(): void {
    this.panel.reveal();
  }

  dispose(): void {
    this.panel.dispose();
  }

  private post(message: ToWebviewMessage): void {
    void this.panel.webview.postMessage(message);
  }

  // ---- lifecycle ----

  private async start(): Promise<void> {
    this.post({ type: 'status', state: 'launching' });
    const config = readConfig();
    try {
      const browser = await acquireBrowser(
        this.context.globalStorageUri.fsPath,
        config.executablePath
      );
      this.acquired = true;
      if (this.disposed) {
        this.acquired = false;
        releaseBrowser();
        return;
      }
      this.browserPort = browser.port;
      const target = await createPageTarget(browser.port, 'about:blank');
      this.targetId = target.targetId;
      const page = await PageClient.attach(target.wsUrl);
      if (this.disposed) {
        void page.close();
        return;
      }
      this.page = page;
      this.wirePage(page);

      const viewport = this.pendingViewport ?? { width: 1280, height: 800, dpr: 1 };
      await page.setViewport(viewport.width, viewport.height, viewport.dpr);
      await page.startScreencast(config.quality);
      this.post({ type: 'connected' });

      const startInput = (this.initialUrl ?? config.startUrl).trim();
      if (startInput) {
        await page.navigate(resolveInput(startInput, config.searchEngine));
      } else {
        this.post({ type: 'focusUrl' });
      }
      await this.refreshNav();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.post({ type: 'status', state: 'error', message });
    }
  }

  private wirePage(page: PageClient): void {
    page.onFrame((frame) => {
      this.post({
        type: 'frame',
        data: frame.data,
        deviceWidth: frame.deviceWidth,
        deviceHeight: frame.deviceHeight,
      });
    });
    page.onNavigated((url) => {
      this.currentUrl = url;
      void this.refreshNav();
    });
    page.onLoading((value) => {
      this.post({ type: 'loading', value });
      if (!value) {
        void this.refreshNav();
      }
    });
    page.onWindowOpen((url) => {
      if (url && url !== 'about:blank') {
        void page.navigate(url).catch(() => undefined);
      }
    });
    page.onClose(() => {
      if (!this.disposed) {
        this.page = undefined;
        this.post({
          type: 'status',
          state: 'error',
          message: vscode.l10n.t('Browser connection lost — close this tab and open it again.'),
        });
      }
    });
  }

  private async refreshNav(): Promise<void> {
    const page = this.page;
    if (!page) {
      return;
    }
    try {
      const state = await page.navState();
      if (state.url) {
        this.currentUrl = state.url;
      }
      this.post({
        type: 'nav',
        url: this.currentUrl,
        canGoBack: state.canGoBack,
        canGoForward: state.canGoForward,
      });
      const title = (await page.title()).trim();
      this.panel.title = title || hostOf(this.currentUrl) || 'Browser';
    } catch {
      // Page went away mid-query — the close handler reports it.
    }
  }

  private onViewStateChanged(): void {
    if (this.panel.active) {
      lastFocused = this;
    }
    const page = this.page;
    if (!page) {
      return;
    }
    // Pause the frame stream while hidden; the canvas keeps the last frame.
    if (this.panel.visible) {
      void page.startScreencast(readConfig().quality).catch(() => undefined);
    } else {
      void page.stopScreencast().catch(() => undefined);
    }
  }

  private cleanup(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    panels.delete(this);
    if (lastFocused === this) {
      lastFocused = [...panels].pop();
    }
    vscode.Disposable.from(...this.disposables).dispose();

    const page = this.page;
    this.page = undefined;
    if (page) {
      void page.close().catch(() => undefined);
    } else if (this.browserPort !== undefined && this.targetId) {
      void closePageTarget(this.browserPort, this.targetId).catch(() => undefined);
    }
    if (this.acquired) {
      this.acquired = false;
      releaseBrowser();
    }
  }

  // ---- webview messages ----

  private async onMessage(message: FromWebviewMessage): Promise<void> {
    const page = this.page;
    switch (message.type) {
      case 'ready':
        void this.start();
        break;
      case 'viewport':
        this.pendingViewport = {
          width: message.width,
          height: message.height,
          dpr: message.dpr,
        };
        if (page) {
          await page
            .setViewport(message.width, message.height, message.dpr)
            .catch(() => undefined);
        }
        break;
      case 'navigate':
        if (page) {
          const url = resolveInput(message.input, readConfig().searchEngine);
          await page.navigate(url).catch(() => undefined);
        }
        break;
      case 'back':
        await page?.goBack().catch(() => undefined);
        void this.refreshNav();
        break;
      case 'forward':
        await page?.goForward().catch(() => undefined);
        void this.refreshNav();
        break;
      case 'reload':
        await page?.reload(message.hard === true).catch(() => undefined);
        break;
      case 'stop':
        await page?.stop().catch(() => undefined);
        break;
      case 'openExternal':
        if (this.currentUrl && this.currentUrl !== 'about:blank') {
          void vscode.env.openExternal(vscode.Uri.parse(this.currentUrl));
        }
        break;
      case 'mouse':
        if (page) {
          const params: Record<string, unknown> = {
            type: message.event,
            x: message.x,
            y: message.y,
            modifiers: message.modifiers,
            pointerType: 'mouse',
          };
          if (message.event === 'mouseWheel') {
            params.deltaX = message.deltaX ?? 0;
            params.deltaY = message.deltaY ?? 0;
          } else {
            params.button = message.button ?? 'none';
            params.buttons = message.buttons ?? 0;
            params.clickCount = message.clickCount ?? 0;
          }
          void page.dispatchMouse(params).catch(() => undefined);
        }
        break;
      case 'key':
        if (page) {
          void page
            .dispatchKey({
              type: message.event,
              modifiers: message.modifiers,
              key: message.key,
              code: message.code,
              text: message.text,
              unmodifiedText: message.text,
              windowsVirtualKeyCode: message.keyCode ?? 0,
              nativeVirtualKeyCode: message.keyCode ?? 0,
              autoRepeat: message.autoRepeat ?? false,
            })
            .catch(() => undefined);
        }
        break;
      case 'insertText':
        void page?.insertText(message.text).catch(() => undefined);
        break;
      case 'copySelection':
        if (page) {
          const text = await page.selection().catch(() => '');
          if (text) {
            void vscode.env.clipboard.writeText(text);
          }
        }
        break;
    }
  }
}

// ======================================
// HTML GENERATION | MARK: HTML
// ======================================

function getWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const html = fs.readFileSync(moduleUri(context, 'ui', 'browser.html').fsPath, 'utf8');
  const css = fs.readFileSync(moduleUri(context, 'ui', 'browser.css').fsPath, 'utf8');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'browser.js')
  );

  const nonce = crypto.randomUUID().replace(/-/g, '');

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return html
    .replace(
      '<!-- ATM_BROWSER_HEAD -->',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">\n\t<style>${css}</style>`
    )
    .replace(
      '<!-- ATM_BROWSER_SCRIPT -->',
      `<script src="${scriptUri}" nonce="${nonce}"></script>`
    );
}

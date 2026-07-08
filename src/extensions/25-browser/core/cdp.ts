import WebSocket = require('ws');

// ======================================
// ATM BROWSER — CDP CLIENT | MARK: CDP
// ======================================
// Minimal Chrome DevTools Protocol client: JSON-RPC over one WebSocket per
// page target. No puppeteer — only the handful of domains the panel needs.

type EventHandler = (params: any) => void;

export class CdpClient {
  private nextId = 1;
  private closed = false;
  private readonly pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void; method: string }
  >();
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly closeHandlers: Array<() => void> = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (raw) => this.onSocketMessage(String(raw)));
    socket.once('close', () => this.onSocketClosed());
    socket.on('error', () => this.onSocketClosed());
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024,
      });
      socket.once('open', () => resolve(new CdpClient(socket)));
      socket.once('error', (error) => reject(error));
    });
  }

  send<T = any>(method: string, params?: object): Promise<T> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`CDP connection closed (while sending ${method})`));
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params: params ?? {} }), (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  on(method: string, handler: EventHandler): void {
    const list = this.handlers.get(method) ?? [];
    list.push(handler);
    this.handlers.set(method, list);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    this.closed = true;
    try {
      this.socket.close();
    } catch {
      // Already closed.
    }
  }

  private onSocketMessage(raw: string): void {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof message.id === 'number') {
      const entry = this.pending.get(message.id);
      if (!entry) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        entry.reject(new Error(`${entry.method}: ${message.error.message ?? 'CDP error'}`));
      } else {
        entry.resolve(message.result);
      }
      return;
    }
    if (typeof message.method === 'string') {
      for (const handler of this.handlers.get(message.method) ?? []) {
        handler(message.params ?? {});
      }
    }
  }

  private onSocketClosed(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const entry of this.pending.values()) {
      entry.reject(new Error(`CDP connection closed (while awaiting ${entry.method})`));
    }
    this.pending.clear();
    for (const handler of this.closeHandlers) {
      handler();
    }
  }
}

// ======================================
// PAGE SESSION | MARK: PAGE
// ======================================

export interface ScreencastFrame {
  /** Base64 JPEG. */
  data: string;
  deviceWidth: number;
  deviceHeight: number;
  pageScaleFactor: number;
  offsetTop: number;
}

export interface NavState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export class PageClient {
  private mainFrameId = '';

  private constructor(private readonly cdp: CdpClient) {}

  static async attach(wsUrl: string): Promise<PageClient> {
    const cdp = await CdpClient.connect(wsUrl);
    const page = new PageClient(cdp);
    await cdp.send('Page.enable');
    const tree = await cdp.send('Page.getFrameTree');
    page.mainFrameId = tree?.frameTree?.frame?.id ?? '';
    // Headless pages report themselves unfocused, which hides carets and
    // hover states — pretend the window is focused.
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
    return page;
  }

  // ---- events ----

  onFrame(callback: (frame: ScreencastFrame) => void): void {
    this.cdp.on('Page.screencastFrame', (params) => {
      // Ack immediately or Chromium stops sending frames.
      void this.cdp
        .send('Page.screencastFrameAck', { sessionId: params.sessionId })
        .catch(() => undefined);
      callback({
        data: params.data,
        deviceWidth: params.metadata?.deviceWidth ?? 0,
        deviceHeight: params.metadata?.deviceHeight ?? 0,
        pageScaleFactor: params.metadata?.pageScaleFactor ?? 1,
        offsetTop: params.metadata?.offsetTop ?? 0,
      });
    });
  }

  onNavigated(callback: (url: string) => void): void {
    this.cdp.on('Page.frameNavigated', (params) => {
      if (params.frame?.id === this.mainFrameId && !params.frame?.parentId) {
        callback(params.frame.url ?? '');
      }
    });
    this.cdp.on('Page.navigatedWithinDocument', (params) => {
      if (params.frameId === this.mainFrameId) {
        callback(params.url ?? '');
      }
    });
  }

  onLoading(callback: (loading: boolean) => void): void {
    this.cdp.on('Page.frameStartedLoading', (params) => {
      if (params.frameId === this.mainFrameId) {
        callback(true);
      }
    });
    this.cdp.on('Page.frameStoppedLoading', (params) => {
      if (params.frameId === this.mainFrameId) {
        callback(false);
      }
    });
  }

  /** Fired for popups / target=_blank when launched with --block-new-web-contents. */
  onWindowOpen(callback: (url: string) => void): void {
    this.cdp.on('Page.windowOpen', (params) => callback(params.url ?? ''));
  }

  onClose(callback: () => void): void {
    this.cdp.onClose(callback);
  }

  // ---- navigation ----

  async navigate(url: string): Promise<void> {
    await this.cdp.send('Page.navigate', { url });
  }

  async reload(hard = false): Promise<void> {
    await this.cdp.send('Page.reload', { ignoreCache: hard });
  }

  async stop(): Promise<void> {
    await this.cdp.send('Page.stopLoading');
  }

  async navState(): Promise<NavState> {
    const history = await this.cdp.send('Page.getNavigationHistory');
    const entries: Array<{ id: number; url: string }> = history?.entries ?? [];
    const index: number = history?.currentIndex ?? 0;
    return {
      url: entries[index]?.url ?? '',
      canGoBack: index > 0,
      canGoForward: index < entries.length - 1,
    };
  }

  async goBack(): Promise<void> {
    await this.goToHistoryOffset(-1);
  }

  async goForward(): Promise<void> {
    await this.goToHistoryOffset(1);
  }

  private async goToHistoryOffset(offset: number): Promise<void> {
    const history = await this.cdp.send('Page.getNavigationHistory');
    const entry = history?.entries?.[(history?.currentIndex ?? 0) + offset];
    if (entry) {
      await this.cdp.send('Page.navigateToHistoryEntry', { entryId: entry.id });
    }
  }

  // ---- rendering ----

  async setViewport(width: number, height: number, deviceScaleFactor: number): Promise<void> {
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: Math.max(100, Math.floor(width)),
      height: Math.max(100, Math.floor(height)),
      deviceScaleFactor,
      mobile: false,
    });
  }

  async startScreencast(quality: number): Promise<void> {
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality,
      maxWidth: 4096,
      maxHeight: 4096,
      everyNthFrame: 1,
    });
  }

  async stopScreencast(): Promise<void> {
    await this.cdp.send('Page.stopScreencast');
  }

  // ---- input ----

  async dispatchMouse(params: object): Promise<void> {
    await this.cdp.send('Input.dispatchMouseEvent', params);
  }

  async dispatchKey(params: object): Promise<void> {
    await this.cdp.send('Input.dispatchKeyEvent', params);
  }

  async insertText(text: string): Promise<void> {
    await this.cdp.send('Input.insertText', { text });
  }

  // ---- misc ----

  async title(): Promise<string> {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: 'document.title',
      returnByValue: true,
    });
    return String(result?.result?.value ?? '');
  }

  async selection(): Promise<string> {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: 'String(window.getSelection())',
      returnByValue: true,
    });
    return String(result?.result?.value ?? '');
  }

  async close(): Promise<void> {
    try {
      await this.cdp.send('Page.close');
    } catch {
      // Tab already gone.
    }
    this.cdp.close();
  }
}

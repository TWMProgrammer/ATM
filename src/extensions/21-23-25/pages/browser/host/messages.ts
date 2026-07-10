// ======================================
// ATM BROWSER — MESSAGE PROTOCOL | MARK: MESSAGES
// ======================================
// Shared between the extension host (host/panel.ts) and the webview bundle
// (ui/browser.ts). Type-only for the webview — esbuild erases the import.

/** Host → webview. */
export type ToWebviewMessage =
  | { type: 'status'; state: 'launching' | 'error'; message?: string }
  | { type: 'connected' }
  | {
      type: 'frame';
      /** Base64 JPEG of the current viewport. */
      data: string;
      deviceWidth: number;
      deviceHeight: number;
    }
  | { type: 'nav'; url: string; canGoBack: boolean; canGoForward: boolean }
  | { type: 'loading'; value: boolean }
  | { type: 'focusUrl' };

export type MouseEventKind = 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
export type KeyEventKind = 'rawKeyDown' | 'keyUp' | 'char';

/** Webview → host. */
export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'navigate'; input: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload'; hard?: boolean }
  | { type: 'stop' }
  | { type: 'openExternal' }
  | { type: 'viewport'; width: number; height: number; dpr: number }
  | {
      type: 'mouse';
      event: MouseEventKind;
      x: number;
      y: number;
      modifiers: number;
      button?: 'left' | 'middle' | 'right' | 'none';
      buttons?: number;
      clickCount?: number;
      deltaX?: number;
      deltaY?: number;
    }
  | {
      type: 'key';
      event: KeyEventKind;
      modifiers: number;
      key?: string;
      code?: string;
      text?: string;
      keyCode?: number;
      autoRepeat?: boolean;
    }
  | { type: 'insertText'; text: string }
  | { type: 'copySelection' };

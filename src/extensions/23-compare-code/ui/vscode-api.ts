// ======================================
// VS CODE WEBVIEW API | MARK: API
// ======================================

/**
 * `acquireVsCodeApi()` may only be called **once** per webview. Previously the
 * top and bottom toolbars each tried to reach the API independently, which left
 * the language selector talking to an `undefined` global. Centralising the call
 * here gives every module a single, shared handle.
 */

export interface HostMessage {
  command:
    | 'ready'
    | 'toggleLeftPanel'
    | 'toggleRightPanel'
    | 'downloadCode'
    | 'changeLanguage';
  content?: string;
  panel?: 'left' | 'right';
  fileExtension?: string;
  language?: string;
}

interface VsCodeApi {
  postMessage(message: HostMessage): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscodeApi: VsCodeApi = acquireVsCodeApi();

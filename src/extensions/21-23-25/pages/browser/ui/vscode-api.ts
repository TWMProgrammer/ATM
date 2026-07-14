import type { FromWebviewMessage } from '../host/messages';

// ======================================
// VS CODE WEBVIEW API | MARK: API
// ======================================

/**
 * `acquireVsCodeApi()` may only be called **once** per webview — centralised
 * here so every UI module shares the same handle.
 */

interface VsCodeApi {
  postMessage(message: FromWebviewMessage): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscodeApi: VsCodeApi = acquireVsCodeApi();

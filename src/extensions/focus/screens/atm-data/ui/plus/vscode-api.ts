/**
 * ATM Data — Centralized VS Code API Access
 * acquireVsCodeApi() must only be called ONCE per webview.
 * This module caches the result for all consumers.
 */

declare function acquireVsCodeApi(): any;

let cachedApi: any = null;

/** Get the VS Code webview API (lazy-initialized, singleton). */
export function getVsCodeApi(): any | null {
    if (cachedApi) { return cachedApi; }
    try {
        cachedApi = acquireVsCodeApi();
        return cachedApi;
    } catch {
        return null;
    }
}

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
    
    // Webviews crash if acquireVsCodeApi() is called twice on the same page.
    // If the main layout (view/ui/index.ts) initialized it, safely reuse it.
    if (typeof window !== 'undefined' && (window as any).vscode) {
        cachedApi = (window as any).vscode;
        return cachedApi;
    }

    try {
        cachedApi = acquireVsCodeApi();
        return cachedApi;
    } catch {
        return null;
    }
}

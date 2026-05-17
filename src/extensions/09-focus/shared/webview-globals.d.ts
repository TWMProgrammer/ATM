/**
 * Global declarations for the webview context.
 * Extends the Window interface with properties injected by the extension host.
 */
interface Window {
    /** Port number of the local audio streaming proxy server */
    STREAM_PORT?: number;

    /** VS Code bridge injected in webview scripts */
    vscode?: {
        postMessage: (message: unknown) => void;
    };
}

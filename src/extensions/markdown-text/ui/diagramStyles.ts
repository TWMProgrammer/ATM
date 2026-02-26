export const diagramStyles = `
.mermaid-zoom-controls {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    width: auto;
    gap: 2px;
    z-index: 100;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, transparent);
    border-radius: 6px;
    padding: 2px;
}

.mermaid-zoom-controls-auto-hide {
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
}

.mermaid-wrapper:hover .mermaid-zoom-controls-auto-hide,
.mermaid-wrapper:focus .mermaid-zoom-controls-auto-hide,
.mermaid-wrapper:focus-within .mermaid-zoom-controls-auto-hide {
    opacity: 1;
}

.mermaid-zoom-controls button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    color: var(--vscode-icon-foreground, #C5C5C5);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
}

.mermaid-zoom-controls button:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.mermaid-zoom-controls button.active {
    background: var(--vscode-toolbar-activeBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-focusBorder, #007acc);
}

.mermaid-wrapper {
    position: relative;
    width: 100%;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: border-color 0.2s ease-in-out;
    margin-bottom: 1em;
}

.mermaid-wrapper:hover,
.mermaid-wrapper:focus,
.mermaid-wrapper:focus-within {
    border-color: var(--vscode-editorWidget-border, #454545);
}

.mermaid-content {
    transform-origin: 0 0;
}

.mermaid-resize-handle {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 10px;
    cursor: ns-resize;
    background: transparent;
    z-index: 50;
}

.mermaid-resize-handle::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 3px;
    background: var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
    transition-delay: 0s;
}

.mermaid-resize-handle:hover::after {
    opacity: 1;
    transition-delay: 0.3s;
}

/* Copy Code Button Styles */
pre {
    position: relative !important;
}

.copy-code-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #cccccc);
    border: 1px solid var(--vscode-widget-border, #454545);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    font-family: var(--vscode-editor-font-family, monospace);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease;
    z-index: 10;
}

pre:hover .copy-code-btn,
pre:focus-within .copy-code-btn {
    opacity: 1;
}

.copy-code-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, #5a5d5e);
    color: var(--vscode-button-secondaryForeground, #ffffff);
}
`;

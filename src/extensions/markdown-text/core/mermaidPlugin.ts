import type MarkdownIt from 'markdown-it';

/**
 * Escapes characters to make text safe for HTML rendering.
 */
function preProcess(source: string): string {
    return source
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n+$/, '')
        .trimStart();
}

/**
 * Super fast markdown-it plugin to intercept 'mermaid' code blocks
 * and output a div that the Webview will later render into an SVG diagram.
 */
export function mermaidPlugin(md: MarkdownIt) {
    const defaultRender = md.renderer.rules.fence || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const info = token.info ? token.info.trim().split(/\s+/)[0].toLowerCase() : '';
        
        // If it's a mermaid block, render our special container instead of syntax highlighted code.
        if (info === 'mermaid') {
            const code = token.content;
            return `<div class="mermaid" style="display: none;">${preProcess(code)}</div>`;
        }

        // For all other languages, fallback to default behavior
        return defaultRender(tokens, idx, options, env, self);
    };
}

// @ts-nocheck
/// <reference lib="dom" />

// Dynamically import mermaid as it is an ESM module and our project uses CJS
async function getMermaid() {
    const mermaidModule = await import('mermaid');
    return mermaidModule.default;
}

import { diagramStyles } from './diagramStyles';

/**
 * Initializes and manages Mermaids blocks injected by markdown-it
 */
async function init() {
    // Inject the styles for the wrapper, zoom controls, etc.
    let styleEl = document.getElementById('atm-mermaid-styles') as HTMLStyleElement;
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'atm-mermaid-styles';
        styleEl.textContent = diagramStyles;
        document.head.appendChild(styleEl);
    }

    const mermaid = await getMermaid();
    const config = {
        startOnLoad: false,
        theme: (document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast')
            ? 'dark' : 'default') as any,
        securityLevel: 'loose' as any
    };

    mermaid.initialize(config);

    // Look for all mermaid divs rendered by our markdown-it plugin
    const elements = document.querySelectorAll<HTMLElement>('.mermaid:not([data-processed="true"])');

    for (let i = 0; i < elements.length; i++) {
        const mermaidContainer = elements[i];
        const source = (mermaidContainer.textContent ?? '').trim();
        if (!source) {
            continue;
        }

        mermaidContainer.setAttribute('data-processed', 'true');
        mermaidContainer.id = 'mermaid-render-' + Math.random().toString(36).substr(2, 9);
        mermaidContainer.innerHTML = '';

        try {
            await mermaid.parse(source);
            const renderResult = await mermaid.render('d' + mermaidContainer.id, source);
            
            // Setup interactive wrapper
            const parent = mermaidContainer.parentNode;

            if (parent) {
                const wrapper = document.createElement('div');
                wrapper.className = 'mermaid-wrapper';

                const controls = document.createElement('div');
                controls.className = 'mermaid-zoom-controls mermaid-zoom-controls-auto-hide';
                // Using basic emoji/unicode icons for blazing fast load, no dependencies
                controls.innerHTML = `
                    <button class="zoom-out-btn" title="Zoom Out">➖</button>
                    <button class="zoom-in-btn" title="Zoom In">➕</button>
                `;

                const content = document.createElement('div');
                content.className = 'mermaid-content';
                content.innerHTML = renderResult.svg;

                // Move container around
                parent.insertBefore(wrapper, mermaidContainer);
                wrapper.appendChild(controls);
                wrapper.appendChild(content);

                mermaidContainer.remove(); // we rendered entirely to 'content'
                
                // Binding functions if there are callbacks
                if (renderResult.bindFunctions) {
                    renderResult.bindFunctions(content);
                }

                // Add simple interactive logic
                setupInteractions(wrapper, content, controls);
            }
            
        } catch (error) {
            const errorMessageNode = document.createElement('pre');
            errorMessageNode.style.color = '#ff4d4f';
            errorMessageNode.innerText = error instanceof Error ? error.message : 'Error rendering diagram';
            mermaidContainer.appendChild(errorMessageNode);
        }
    }
}

/**
 * Super lightweight setup for zooming and panning with Vanilla JS
 */
function setupInteractions(wrapper: HTMLElement, content: HTMLElement, controls: HTMLElement) {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    function applyTransform() {
        content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // Controls
    controls.querySelector('.zoom-in-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        scale = Math.min(scale * 1.25, 5);
        applyTransform();
    });

    controls.querySelector('.zoom-out-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        scale = Math.max(scale * 0.8, 0.2);
        applyTransform();
    });

    // Panning
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) {
            return; // Only left click
        }
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        wrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) {
            return;
        }
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        wrapper.style.cursor = 'default';
    });

    // Zooming natively with wheel
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.2), 5);

        // Pan compensator
        const scaleFactor = newScale / scale;
        translateX = mouseX - (mouseX - translateX) * scaleFactor;
        translateY = mouseY - (mouseY - translateY) * scaleFactor;

        scale = newScale;
        applyTransform();
    }, { passive: false });
}

// Hook into VS Code Markdown preview updates
window.addEventListener('vscode.markdown.updateContent', init);

// Run initially
init();

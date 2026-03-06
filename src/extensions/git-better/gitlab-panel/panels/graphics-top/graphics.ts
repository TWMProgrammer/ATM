import type { GraphicsCommitData } from '../../shared/types';

/**
 * Graphics panel logic — manages the display of the commit activity sparkline
 * Handles skeleton fading and real data plotting into the SVG canvas.
 */

class GraphicsManager {
    private vscode: any;
    private skeletonContainer: HTMLElement | null;
    private graphContainer: HTMLElement | null;
    private hasRenderedGraphics = false;

    constructor() {
        // @ts-ignore - window.vscodeApi is injected in index.html
        this.vscode = (window as any).vscodeApi;
        this.skeletonContainer = document.getElementById('graphics-skeleton-container');
        this.graphContainer = document.getElementById('graphics-graph-container');
        
        this.init();
    }

    private init() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'renderGraphics':
                    if (!this.hasRenderedGraphics && message.data) {
                        this.renderActivityGraph(message.data);
                        this.showRealData();
                        this.hasRenderedGraphics = true;
                    }
                    break;
            }
        });

        // Request initial data
        if (this.vscode) {
            this.vscode.postMessage({ type: 'ready' });
        }
    }

    private renderActivityGraph(data: GraphicsCommitData[]) {
        const svg = document.getElementById('graphics-svg');
        if (!svg || !data || data.length === 0) {return;}

        // Save defs globally
        const defs = svg.querySelector('defs');
        svg.innerHTML = '';
        if (defs) {
            svg.appendChild(defs);
        }

        const width = 1000;
        const height = 32;
        const paddingY = 6;
        const effectiveHeight = height - (paddingY * 2);

        // Calculate max lines for scaling the graph visually
        const maxLines = Math.max(...data.map(d => d.linesChanged), 1);
        
        const namespace = 'http://www.w3.org/2000/svg';

        // Calculate points (X across the width, Y representing changed lines intensity)
        const points = data.map((d, index) => {
            const x = data.length > 1 ? (index / (data.length - 1)) * width : width / 2;
            
            // Map lines changed to y (inverted so higher is visually higher up).
            // Example: max lines -> y = 6, 0 lines -> y = 26
            const normalizedY = height - paddingY - ((d.linesChanged / maxLines) * effectiveHeight);
            
            return { x, y: normalizedY };
        });

        // Build Paths
        let dPath = `M${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            // Cubic bezier smoothing can be added, but straight lines are fine for a sparkline
            dPath += ` L${points[i].x},${points[i].y}`;
        }
        
        // Area under the curve
        const areaPathStr = dPath + ` L${width},${height} L0,${height} Z`;

        const areaEl = document.createElementNS(namespace, 'path');
        areaEl.setAttribute('d', areaPathStr);
        areaEl.setAttribute('fill', 'url(#area-gradient)');
        areaEl.setAttribute('class', 'sparkline-area');

        const lineEl = document.createElementNS(namespace, 'path');
        lineEl.setAttribute('d', dPath);
        lineEl.setAttribute('fill', 'none');
        lineEl.setAttribute('stroke', 'url(#line-gradient)');
        lineEl.setAttribute('class', 'sparkline-path');

        svg.appendChild(areaEl);
        svg.appendChild(lineEl);

        // Draw Nodes
        points.forEach((p, i) => {
            const nodeData = data[i];

            if (nodeData.isHead) {
                // Pulse for latest commit
                const pulse = document.createElementNS(namespace, 'circle');
                pulse.setAttribute('cx', String(p.x));
                pulse.setAttribute('cy', String(p.y));
                pulse.setAttribute('r', '5');
                pulse.setAttribute('class', 'sparkline-pulse pulse-delay');
                svg.appendChild(pulse);
                
                const node = document.createElementNS(namespace, 'circle');
                node.setAttribute('cx', String(p.x));
                node.setAttribute('cy', String(p.y));
                node.setAttribute('r', '3');
                node.setAttribute('class', 'sparkline-node active');
                
                const title = document.createElementNS(namespace, 'title');
                title.textContent = `Head: ${nodeData.hash.substring(0,7)} (${nodeData.linesChanged} changes)`;
                node.appendChild(title);
                
                svg.appendChild(node);
            } else {
                // Regular node
                const node = document.createElementNS(namespace, 'circle');
                node.setAttribute('cx', String(p.x));
                node.setAttribute('cy', String(p.y));
                node.setAttribute('r', '1.5');
                node.setAttribute('class', 'sparkline-node');
                
                const title = document.createElementNS(namespace, 'title');
                title.textContent = `${nodeData.hash.substring(0,7)} (${nodeData.linesChanged} changes)`;
                node.appendChild(title);
                
                svg.appendChild(node);
            }
        });
    }

    private showRealData() {
        if (this.skeletonContainer) {
            this.skeletonContainer.style.opacity = '0';
            setTimeout(() => {
                if (this.skeletonContainer) {
                    this.skeletonContainer.style.display = 'none';
                }
            }, 300);
        }

        if (this.graphContainer) {
            this.graphContainer.style.opacity = '1';
        }
    }
}

// ── Initialize ───────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GraphicsManager();
    });
} else {
    new GraphicsManager();
}

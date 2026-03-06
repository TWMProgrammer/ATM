import type { GraphicsCommitData } from '../../shared/types';

/**
 * Graphics panel logic — manages the display of the commit activity sparkline
 * Incorporates a beautiful interactive Tooltip and smooth curvy graphs.
 */

class GraphicsManager {
    private vscode: any;
    private skeletonContainer: HTMLElement | null;
    private graphContainer: HTMLElement | null;
    private tooltip: HTMLElement | null;
    private hasRenderedGraphics = false;

    constructor() {
        // @ts-ignore
        this.vscode = (window as any).vscodeApi;
        this.skeletonContainer = document.getElementById('graphics-skeleton-container');
        this.graphContainer = document.getElementById('graphics-graph-container');
        this.tooltip = document.getElementById('graphics-tooltip');
        
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
        if (!svg || !data || data.length === 0) { return; }

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
            const normalizedY = height - paddingY - ((d.linesChanged / maxLines) * effectiveHeight);
            return { x, y: normalizedY };
        });

        // Build Smooth Path (Cubic Bezier)
        let dPath = `M${points[0].x},${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            // Simple horizontal smooth interpolation
            const cpX1 = prev.x + (curr.x - prev.x) / 3;
            const cpX2 = curr.x - (curr.x - prev.x) / 3;
            dPath += ` C${cpX1},${prev.y} ${cpX2},${curr.y} ${curr.x},${curr.y}`;
        }
        
        // Area under the curve
        const areaPathStr = dPath + ` L${width},${height} L0,${height} Z`;

        const areaEl = document.createElementNS(namespace, 'path');
        areaEl.setAttribute('d', areaPathStr);
        areaEl.setAttribute('fill', 'url(#area-gradient)');
        areaEl.setAttribute('class', 'sparkline-area');
        svg.appendChild(areaEl);

        const lineEl = document.createElementNS(namespace, 'path');
        lineEl.setAttribute('d', dPath);
        lineEl.setAttribute('fill', 'none');
        lineEl.setAttribute('stroke', 'url(#line-gradient)');
        lineEl.setAttribute('class', 'sparkline-path');
        svg.appendChild(lineEl);

        // Draw Nodes with Hover Regions
        points.forEach((p, i) => {
            const nodeData = data[i];
            
            // To make hovering easier, we add an invisible hit-target circle
            const hitTarget = document.createElementNS(namespace, 'circle');
            hitTarget.setAttribute('cx', String(p.x));
            hitTarget.setAttribute('cy', String(p.y));
            hitTarget.setAttribute('r', '10');
            hitTarget.setAttribute('fill', 'transparent');
            hitTarget.style.cursor = 'pointer';

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
                // Give it an id we can animate if we want
                node.setAttribute('id', `node-${i}`);
                svg.appendChild(node);
            } else {
                // Regular node
                const node = document.createElementNS(namespace, 'circle');
                node.setAttribute('cx', String(p.x));
                node.setAttribute('cy', String(p.y));
                node.setAttribute('r', '1.5');
                node.setAttribute('class', 'sparkline-node');
                node.setAttribute('id', `node-${i}`);
                svg.appendChild(node);
            }

            // Append Hit target last so it sits on top
            svg.appendChild(hitTarget);

            // Add Event Listeners for Tooltip
            hitTarget.addEventListener('mouseenter', (e) => this.showTooltip(e, nodeData, i));
            hitTarget.addEventListener('mouseleave', () => this.hideTooltip(i));
        });
    }

    private showTooltip(e: MouseEvent, data: GraphicsCommitData, index: number) {
        if (!this.tooltip || !this.graphContainer) { return; }
    
        // Update Tooltip Content
        const hashEl = this.tooltip.querySelector('.tooltip-hash');
        const dateEl = this.tooltip.querySelector('.tooltip-date');
        const authorEl = this.tooltip.querySelector('.tooltip-author');
        const changesEl = this.tooltip.querySelector('.tooltip-changes');

        if (hashEl) { hashEl.textContent = data.hash.substring(0, 7) + (data.isHead ? ' (HEAD)' : ''); }
        if (dateEl) { dateEl.textContent = data.date; }
        if (authorEl) { authorEl.textContent = data.author; }
        if (changesEl) { 
            changesEl.textContent = `${data.linesChanged} line${data.linesChanged === 1 ? '' : 's'}`; 
        }

        // Highlight the node
        const node = document.getElementById(`node-${index}`);
        if (node) {
            node.style.transform = 'scale(2)';
            node.style.fill = 'var(--accent-blue)';
            node.style.strokeWidth = '0';
        }

        // Position Tooltip
        const containerRect = this.graphContainer.getBoundingClientRect();
        
        // Use clientX relative to container, adding scroll just in case
        let left = e.clientX - containerRect.left;
        
        // Prevent going off-screen to the right
        const tooltipWidth = 160; 
        if (left + (tooltipWidth / 2) > containerRect.width) {
            left = containerRect.width - (tooltipWidth / 2) - 10;
        } else if (left - (tooltipWidth / 2) < 0) {
            // Prevent going off-screen to the left
            left = (tooltipWidth / 2) + 10;
        }

        // We position it above the cursor (the translate(-50%, 15px) is overridden)
        this.tooltip.style.transform = `translate(-50%, 25px)`;
        this.tooltip.style.left = `${left}px`;
        
        this.tooltip.classList.add('show');
    }

    private hideTooltip(index: number) {
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
        }
        
        // Reset node scaling
        const node = document.getElementById(`node-${index}`);
        if (node) {
            node.style.transform = '';
            node.style.fill = '';
            node.style.strokeWidth = '';
        }
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

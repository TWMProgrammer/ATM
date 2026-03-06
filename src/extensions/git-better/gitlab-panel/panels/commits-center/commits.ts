/**
 * Graph Renderer — Draws the Git Graph (SVG tree nodes + connecting paths)
 * on top of the commit table rows.
 */
export class GraphRenderer {
    private overlay: HTMLDivElement | null;
    private svgNamespace = 'http://www.w3.org/2000/svg';
    private resizeObserver: ResizeObserver | null = null;

    private colors = {
        0: 'var(--accent-brand)',
        1: 'var(--accent-blue)',
        2: 'var(--accent-purple)',
        3: 'var(--accent-orange)'
    };

    constructor() {
        this.overlay = document.getElementById('tree-graph-overlay') as HTMLDivElement;
        this.init();
    }

    private init() {
        this.drawTreeGraph();
        this.setupResizeObserver();

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'toggleExpand') {
                setTimeout(() => this.drawTreeGraph(), 300);
            }
        });
    }

    private setupResizeObserver() {
        const tableBody = document.querySelector('.table-body');
        if (!tableBody) { return; }

        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => this.drawTreeGraph());
        });
        this.resizeObserver.observe(tableBody);

        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.drawTreeGraph());
        });
    }

    public drawTreeGraph() {
        if (!this.overlay) { return; }

        this.overlay.innerHTML = '';

        const svg = document.createElementNS(this.svgNamespace, 'svg') as SVGSVGElement & HTMLElement;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.overflow = 'visible';

        this.overlay.appendChild(svg);
        const overlayRect = this.overlay.getBoundingClientRect();

        const placeholders = document.querySelectorAll('.table-row .node-placeholder');
        const nodes: { x: number, y: number, color: string, branch: number }[] = [];

        placeholders.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const x = (rect.left - overlayRect.left) + (rect.width / 2);
            const y = (rect.top - overlayRect.top) + (rect.height / 2);

            const branch = parseInt(el.getAttribute('data-branch') || '0', 10);
            const color = el.getAttribute('data-color') || this.colors[branch as keyof typeof this.colors];

            nodes.push({ x, y, color, branch });
        });

        if (nodes.length === 0) { return; }

        // Draw connecting paths
        for (let i = 1; i < nodes.length; i++) {
            const current = nodes[i];
            const previous = nodes[i - 1];

            const pathSource = this.createCurvedPath(current.x, current.y, previous.x, previous.y);

            const pathNode = document.createElementNS(this.svgNamespace, 'path') as SVGPathElement & HTMLElement;
            pathNode.setAttribute('d', pathSource);
            pathNode.setAttribute('fill', 'none');
            pathNode.setAttribute('stroke', current.color);
            pathNode.setAttribute('stroke-width', '2');
            pathNode.setAttribute('stroke-linecap', 'round');
            pathNode.style.opacity = '0.6';

            svg.appendChild(pathNode);
        }

        // Draw commit nodes
        nodes.forEach(node => {
            const shadow = document.createElementNS(this.svgNamespace, 'circle');
            shadow.setAttribute('cx', String(node.x));
            shadow.setAttribute('cy', String(node.y));
            shadow.setAttribute('r', '6');
            shadow.setAttribute('fill', 'var(--bg-base)');
            shadow.setAttribute('opacity', '0.8');
            svg.appendChild(shadow);

            const circle = document.createElementNS(this.svgNamespace, 'circle');
            circle.setAttribute('cx', String(node.x));
            circle.setAttribute('cy', String(node.y));
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', node.color);
            circle.setAttribute('stroke', 'var(--bg-base)');
            circle.setAttribute('stroke-width', '2');
            svg.appendChild(circle);
        });
    }

    private createCurvedPath(x1: number, y1: number, x2: number, y2: number): string {
        if (Math.abs(x1 - x2) < 2) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => new GraphRenderer(), 50);
    });
} else {
    setTimeout(() => new GraphRenderer(), 50);
}

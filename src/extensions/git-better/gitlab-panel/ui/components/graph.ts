/**
 * Graph Renderer
 * Handles the drawing logic for the Git Graph (Minimap & Table Nodes)
 */
export class GraphRenderer {
    private overlay: HTMLDivElement | null;
    private svgNamespace = 'http://www.w3.org/2000/svg';
    private resizeObserver: ResizeObserver | null = null;
    
    // Theme colors to read from CSS
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
        // Draw the main table tree graph initially
        this.drawTreeGraph();

        // Ensure we redraw when layout changes (e.g., resizing columns, window, or collapsible panels)
        this.setupResizeObserver();
        
        // Listen to custom events from our panel toggler
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'toggleExpand') {
                // Give CSS transition time to run, then redraw
                setTimeout(() => this.drawTreeGraph(), 300);
            }
        });
    }

    /**
     * Monitors the table body for size/layout changes to redraw paths.
     */
    private setupResizeObserver() {
        const tableBody = document.querySelector('.table-body');
        if (!tableBody) {
            return;
        }

        this.resizeObserver = new ResizeObserver(() => {
            // Using requestAnimationFrame to batch redraws heavily during rapid resizing
            requestAnimationFrame(() => this.drawTreeGraph());
        });
        this.resizeObserver.observe(tableBody);
        
        // Also observe main window
        window.addEventListener('resize', () => {
             requestAnimationFrame(() => this.drawTreeGraph());
        });
    }

    /**
     * Scans the DOM for placeholders, calculates their global XY coordinates, and draws sleek curved SVGs.
     */
    public drawTreeGraph() {
        if (!this.overlay) {
            return;
        }

        // Clear previous drawing
        this.overlay.innerHTML = '';

        // 1. Setup SVG Canvas to cover the entire overlay
        const svg = document.createElementNS(this.svgNamespace, 'svg') as SVGSVGElement & HTMLElement;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.overflow = 'visible';

        // Add to DOM immediately so we can calculate bounding rects relative to it
        this.overlay.appendChild(svg);
        const overlayRect = this.overlay.getBoundingClientRect();

        // 2. Find all node placeholders in the table rows
        const placeholders = document.querySelectorAll('.table-row .node-placeholder');
        const nodes: { x: number, y: number, color: string, branch: number }[] = [];

        placeholders.forEach((el) => {
            const rect = el.getBoundingClientRect();
            // Calculate center of the placeholder column relative to the canvas
            const x = (rect.left - overlayRect.left) + (rect.width / 2);
            const y = (rect.top - overlayRect.top) + (rect.height / 2);
            
            const branch = parseInt(el.getAttribute('data-branch') || '0', 10);
            const color = el.getAttribute('data-color') || this.colors[branch as keyof typeof this.colors];

            nodes.push({ x, y, color, branch });
        });

        if (nodes.length === 0) {
            return;
        }

        // 3. Draw Connecting Paths (Lines) - Bottom to Top
        // For this mock prototype we just draw a line from node N to N-1
        // (In real life we will read child->parent relationships)
        for (let i = 1; i < nodes.length; i++) {
            const current = nodes[i];
            const previous = nodes[i - 1]; // Assume continuous commit history for now

            const pathSource = this.createCurvedPath(current.x, current.y, previous.x, previous.y);
            
            const pathNode = document.createElementNS(this.svgNamespace, 'path') as SVGPathElement & HTMLElement;
            pathNode.setAttribute('d', pathSource);
            pathNode.setAttribute('fill', 'none');
            // Path takes the color of the current node (the child)
            pathNode.setAttribute('stroke', current.color);
            pathNode.setAttribute('stroke-width', '2');
            pathNode.setAttribute('stroke-linecap', 'round');
            
            // Add slight transparency/fade to the lines like git graph does
            pathNode.style.opacity = '0.6';

            svg.appendChild(pathNode);
        }

        // 4. Draw Commit Nodes (Circles) on top of lines
        nodes.forEach(node => {
            // Shadow / Glow effect
            const shadow = document.createElementNS(this.svgNamespace, 'circle');
            shadow.setAttribute('cx', String(node.x));
            shadow.setAttribute('cy', String(node.y));
            shadow.setAttribute('r', '6');
            shadow.setAttribute('fill', 'var(--bg-base)');
            shadow.setAttribute('opacity', '0.8');
            svg.appendChild(shadow);

            // Main dot
            const circle = document.createElementNS(this.svgNamespace, 'circle');
            circle.setAttribute('cx', String(node.x));
            circle.setAttribute('cy', String(node.y));
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', node.color);
            // Internal stroke matching background to make it look "punched out"
            circle.setAttribute('stroke', 'var(--bg-base)');
            circle.setAttribute('stroke-width', '2');
            
            svg.appendChild(circle);
        });
    }

    /**
     * Generates a sleek, Bezier curved path string from (x1, y1) to (x2, y2).
     */
    private createCurvedPath(x1: number, y1: number, x2: number, y2: number): string {
        // If they are on the same vertical line, just draw a straight line
        if (Math.abs(x1 - x2) < 2) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        // Calculate a nice S-curve using cubic bezier. 
        // We push the control points horizontally but midway vertically
        const midY = (y1 + y2) / 2;
        
        return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Use a short timeout to let CSS fonts/layouts settle the row heights perfectly
        setTimeout(() => new GraphRenderer(), 50);
    });
} else {
    setTimeout(() => new GraphRenderer(), 50);
}

import * as vscode from "vscode";

export class Icons {
    private static _extensionContext: vscode.ExtensionContext;
    private static _svgLogoCache: string | null = null;
    private static _svgDotsCache: string | null = null;
    
    public static initialize(context: vscode.ExtensionContext) {
        this._extensionContext = context;
    }

    private static async getSvgLogo(): Promise<string> {
        if (this._svgLogoCache) {
            return this._svgLogoCache;
        }
        
        try {
            const svgPath = vscode.Uri.joinPath(this._extensionContext.extensionUri, "src", "extensions", "16-tailwind-css", "icons", "tailwind-logo.svg");
            const data = await vscode.workspace.fs.readFile(svgPath);
            this._svgLogoCache = Buffer.from(data).toString("utf8");
            return this._svgLogoCache;
        } catch (error) {
            console.error("Error reading SVG logo tailwind-css", error);
            return `<svg viewBox="0 0 54 32" width="54" height="32"><rect fill="#41A0C9" width="54" height="32"/></svg>`;
        }
    }

    private static async getSvgDots(): Promise<string> {
        if (this._svgDotsCache) {
            return this._svgDotsCache;
        }
        
        try {
            const svgPath = vscode.Uri.joinPath(this._extensionContext.extensionUri, "src", "extensions", "16-tailwind-css", "icons", "tailwind-dots.svg");
            const data = await vscode.workspace.fs.readFile(svgPath);
            this._svgDotsCache = Buffer.from(data).toString("utf8");
            return this._svgDotsCache;
        } catch (error) {
            console.error("Error reading SVG dots tailwind-css", error);
            return `<svg viewBox="0 0 76 10" width="76" height="10"><circle cx="5" cy="5" r="5" fill="#41A0C9"/></svg>`;
        }
    }

    public static async generateScaledSVGDataURI(): Promise<vscode.Uri> {
        const svgLogo = await this.getSvgLogo();
        const svgDots = await this.getSvgDots();
        
        const fontSize = vscode.workspace.getConfiguration("editor").get<number>("fontSize", 14);
        const scaleFactor = 0.672; // Reduced by additional 20% (0.84 * 0.8 = 0.672)
        
        // Calculate dimensions for logo (wider aspect ratio)
        const logoHeight = fontSize * scaleFactor;
        const logoWidth = logoHeight * (54 / 32); // Maintain aspect ratio
        
        // Calculate dimensions for dots (wider aspect ratio)
        const dotsHeight = fontSize * scaleFactor * 0.3; // Smaller height for dots
        const dotsWidth = dotsHeight * (76 / 10); // Maintain aspect ratio
        
        // Add spacing for dots
        const dotsPaddingLeft = 10; // Separation from logo
        const dotsPaddingTop = 10; // Move dots down
        
        // Total width includes logo + padding + dots
        const totalWidth = logoWidth + dotsPaddingLeft + dotsWidth;
        const totalHeight = Math.max(logoHeight, dotsHeight + dotsPaddingTop);
        
        // Extract viewBox and paths from both SVGs
        const logoViewBox = svgLogo.match(/viewBox="([^"]+)"/)?.[1] || "0 0 54 32";
        const dotsViewBox = svgDots.match(/viewBox="([^"]+)"/)?.[1] || "0 0 76 10";
        
        const logoContent = svgLogo.replace(/<svg[^>]*>|<\/svg>/g, "");
        const dotsContent = svgDots.replace(/<svg[^>]*>|<\/svg>/g, "");
        
        // Calculate dots position (logo width + padding left, and padding top)
        const dotsX = 54 + dotsPaddingLeft;
        const dotsY = 11 + dotsPaddingTop;
        
        // Combine both SVGs with spacing
        const combinedSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${54 + dotsPaddingLeft + 76} 32">
  <g transform="translate(0, 0)">
    <svg viewBox="${logoViewBox}" width="54" height="32" x="0" y="0">
      ${logoContent}
    </svg>
  </g>
  <g transform="translate(${dotsX}, ${dotsY})">
    <svg viewBox="${dotsViewBox}" width="76" height="10" x="0" y="0">
      ${dotsContent}
    </svg>
  </g>
</svg>`;

        const svgBase64 = Buffer.from(combinedSVG).toString("base64");
        return vscode.Uri.parse(`data:image/svg+xml;base64,${svgBase64}`);
    }
}

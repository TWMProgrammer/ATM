import * as vscode from "vscode";
import { Utils } from "vscode-uri";

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
            const svgPath = vscode.Uri.joinPath(this._extensionContext.extensionUri, "src", "extensions", "tailwind-fold", "icons", "tailwind-logo.svg");
            const data = await vscode.workspace.fs.readFile(svgPath);
            this._svgLogoCache = Buffer.from(data).toString("utf8");
            return this._svgLogoCache;
        } catch (error) {
            console.error("Error reading SVG logo tailwind-fold", error);
            return `<svg viewBox="0 0 54 32" width="54" height="32"><rect fill="#41A0C9" width="54" height="32"/></svg>`;
        }
    }

    private static async getSvgDots(): Promise<string> {
        if (this._svgDotsCache) {
            return this._svgDotsCache;
        }
        
        try {
            const svgPath = vscode.Uri.joinPath(this._extensionContext.extensionUri, "src", "extensions", "tailwind-fold", "icons", "tailwind-dots.svg");
            const data = await vscode.workspace.fs.readFile(svgPath);
            this._svgDotsCache = Buffer.from(data).toString("utf8");
            return this._svgDotsCache;
        } catch (error) {
            console.error("Error reading SVG dots tailwind-fold", error);
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
        
        // Total width is logo + dots (no gap)
        const totalWidth = logoWidth + dotsWidth;
        const totalHeight = Math.max(logoHeight, dotsHeight);
        
        // Extract viewBox and paths from both SVGs
        const logoViewBox = svgLogo.match(/viewBox="([^"]+)"/)?.[1] || "0 0 54 32";
        const dotsViewBox = svgDots.match(/viewBox="([^"]+)"/)?.[1] || "0 0 76 10";
        
        const logoContent = svgLogo.replace(/<svg[^>]*>|<\/svg>/g, "");
        const dotsContent = svgDots.replace(/<svg[^>]*>|<\/svg>/g, "");
        
        // Combine both SVGs side by side with no gap
        const combinedSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${54 + 76} 32">
  <g transform="translate(0, 0)">
    <svg viewBox="${logoViewBox}" width="54" height="32" x="0" y="0">
      ${logoContent}
    </svg>
  </g>
  <g transform="translate(54, 11)">
    <svg viewBox="${dotsViewBox}" width="76" height="10" x="0" y="0">
      ${dotsContent}
    </svg>
  </g>
</svg>`;

        const svgBase64 = Buffer.from(combinedSVG).toString("base64");
        return vscode.Uri.parse(`data:image/svg+xml;base64,${svgBase64}`);
    }
}

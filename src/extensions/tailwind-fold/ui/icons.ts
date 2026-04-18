import * as vscode from "vscode";
import { Utils } from "vscode-uri";

export class Icons {
    private static _extensionContext: vscode.ExtensionContext;
    private static _svgContentCache: string | null = null;
    
    public static initialize(context: vscode.ExtensionContext) {
        this._extensionContext = context;
    }

    private static async getSvgContent(): Promise<string> {
        if (this._svgContentCache) {
            return this._svgContentCache;
        }
        
        try {
            // Updated path to point dynamically directly at the new inner folder location.
            const svgPath = vscode.Uri.joinPath(this._extensionContext.extensionUri, "src", "extensions", "tailwind-fold", "icons", "tailwind-icon.svg");
            const data = await vscode.workspace.fs.readFile(svgPath);
            this._svgContentCache = Buffer.from(data).toString("utf8");
            return this._svgContentCache;
        } catch (error) {
            console.error("Error read SVG icon tailwind-fold", error);
            // Minimal fallback SVG for errors
            return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 6h16M4 12h16m-7 6h7"></path></svg>`;
        }
    }

    public static async generateScaledSVGDataURI(): Promise<vscode.Uri> {
        const svgContent = await this.getSvgContent();
        
        const fontSize = vscode.workspace.getConfiguration("editor").get<number>("fontSize", 14);
        const scaleFactor = 1.4; // Increased from 0.9 to make it bigger
        const horizontalScale = 1.8; // Make it wider horizontally
        const width = fontSize * scaleFactor * horizontalScale;
        const height = fontSize * scaleFactor;

        // Naive scalable replacement to fit the text height
        const resizedSVGContent = svgContent
            .replace(/width=".*?"/, `width="${width}"`)
            .replace(/height=".*?"/, `height="${height}"`);

        const svgBase64 = Buffer.from(resizedSVGContent).toString("base64");
        return vscode.Uri.parse(`data:image/svg+xml;base64,${svgBase64}`);
    }
}

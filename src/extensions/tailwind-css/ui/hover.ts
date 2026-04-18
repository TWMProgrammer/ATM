import * as vscode from "vscode";
import { Decorator } from "../core/decorator";

export class TailwindFoldHoverProvider implements vscode.HoverProvider {
    constructor(private decorator: Decorator) {}

    private static escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        if (!this.decorator.autoFold) {return null;}

        const foldedRanges = this.decorator.getFoldedRanges();
        for (const range of foldedRanges) {
            if (range.contains(position)) {
                const text = document.getText(range);
                const md = new vscode.MarkdownString();
                
                const matchQuote = text.match(/['"`{]/);
                const splitIndex = matchQuote ? matchQuote.index : -1;

                if (splitIndex !== undefined && splitIndex > 0) {
                    const attr = text.substring(0, splitIndex).trim();
                    const classes = text.substring(splitIndex);
                    const escapedAttr = TailwindFoldHoverProvider.escapeHtml(attr);
                    const escapedClasses = TailwindFoldHoverProvider.escapeHtml(classes);
                    
                    md.supportHtml = true;
                    md.appendMarkdown(`<code><span style="color: var(--vscode-textLink-foreground);"><b>${escapedAttr}</b></span>${escapedClasses}</code>`);
                } else {
                    md.appendCodeblock(text, "html");
                }

                return new vscode.Hover(md, range);
            }
        }
        return null;
    }
}

import * as vscode from "vscode";
import { Decorator } from "../core/decorator";

export class TailwindFoldHoverProvider implements vscode.HoverProvider {
    constructor(private decorator: Decorator) {}

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
                md.appendCodeblock(text, "html");
                return new vscode.Hover(md, range);
            }
        }
        return null;
    }
}

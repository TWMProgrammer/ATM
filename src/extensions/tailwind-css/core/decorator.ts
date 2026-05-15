import * as vscode from "vscode";
import { Parser } from "./parser";
import { createFoldedDecorationType, createUnfoldedDecorationType } from "./decorations";
import * as Config from "./config";
import { Settings } from "./config";

export class Decorator {
    private static readonly foldedClickHitSlopChars = 12;

    activeEditor: vscode.TextEditor | undefined;

    autoFold: boolean = true;
    unfoldIfLineSelected: boolean = false;
    supportedLanguages: string[] = [];

    // Cached matches to improve performance on selection change
    cachedMatches: { range: vscode.Range }[] = [];

    unfoldedDecorationType: vscode.TextEditorDecorationType | undefined;
    foldedDecorationType: vscode.TextEditorDecorationType | undefined;

    foldedRanges: vscode.Range[] = [];
    unfoldedRanges: vscode.Range[] = [];

    // Debounce full document reparsing to avoid running the parser on every keystroke.
    private reparseDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.loadConfig().then(() => {
            this.setActiveEditor(vscode.window.activeTextEditor);
        });
    }

    public setActiveEditor(textEditor: vscode.TextEditor | undefined) {
        if (!textEditor) {
            return;
        }

        this.cancelScheduledReparse();
        this.activeEditor = textEditor;
        this.recalculateMatches(); // Run RegEx only when document/editor changes
        this.updateDecorations();
    }

    public scheduleReparseAndUpdate(delayMs: number = 300) {
        this.cancelScheduledReparse();

        this.reparseDebounceTimer = setTimeout(() => {
            this.reparseDebounceTimer = undefined;
            this.recalculateMatches();
            this.updateDecorations();
        }, delayMs);
    }

    public cancelScheduledReparse() {
        if (!this.reparseDebounceTimer) {
            return;
        }

        clearTimeout(this.reparseDebounceTimer);
        this.reparseDebounceTimer = undefined;
    }

    public toggleAutoFold(): boolean {
        this.autoFold = !this.autoFold;
        Config.set(Settings.AutoFold, this.autoFold);
        this.updateDecorations();
        return this.autoFold;
    }

    public async loadConfig() {
        this.autoFold = Config.get<boolean>(Settings.AutoFold, true);
        this.unfoldIfLineSelected = Config.get<boolean>(Settings.UnfoldIfLineSelected, false);
        this.supportedLanguages = Config.get<string[]>(Settings.SupportedLanguages, ["html", "vue", "javascriptreact", "typescriptreact", "svelte", "astro"]);

        if (this.unfoldedDecorationType) {this.unfoldedDecorationType.dispose();}
        if (this.foldedDecorationType) {this.foldedDecorationType.dispose();}

        this.unfoldedDecorationType = await createUnfoldedDecorationType();
        this.foldedDecorationType = await createFoldedDecorationType();

        this.recalculateMatches();
        this.updateDecorations();
    }

    public recalculateMatches() {
        if (!this.activeEditor) {
            return;
        }

        if (this.supportedLanguages.length > 0 && !this.supportedLanguages.includes(this.activeEditor.document.languageId)) {
            this.cachedMatches = [];
            return; // unsupported lang
        }

        const documentText = this.activeEditor.document.getText();
        const foldStyle = Config.get<string>(Settings.FoldStyle, "ALL") as "ALL" | "QUOTES";

        const matches = Parser.getMatches(documentText, foldStyle);
        this.cachedMatches = matches.map(match => ({
            range: new vscode.Range(
                this.activeEditor!.document.positionAt(match.start),
                this.activeEditor!.document.positionAt(match.start + match.length)
            )
        }));
    }

    public updateDecorations() {
        if (!this.activeEditor || !this.unfoldedDecorationType || !this.foldedDecorationType) {
            return;
        }

        if (this.supportedLanguages.length > 0 && !this.supportedLanguages.includes(this.activeEditor.document.languageId)) {
            // Clear stale decorations when switching into unsupported files.
            this.foldedRanges = [];
            this.unfoldedRanges = [];
            this.activeEditor.setDecorations(this.unfoldedDecorationType, []);
            this.activeEditor.setDecorations(this.foldedDecorationType, []);
            return;
        }

        this.foldedRanges = [];
        this.unfoldedRanges = [];

        const foldLengthThreshold = Config.get<number>(Settings.FoldLengthThreshold, 0);

        for (const cache of this.cachedMatches) {
            const range = cache.range;
            const textLength = this.activeEditor.document.offsetAt(range.end) - this.activeEditor.document.offsetAt(range.start);

            if (
                !this.autoFold ||
                this.isRangeSelected(range) ||
                (this.unfoldIfLineSelected && this.isLineOfRangeSelected(range)) ||
                textLength < foldLengthThreshold
            ) {
                this.unfoldedRanges.push(range);
                continue;
            }

            this.foldedRanges.push(range);
        }

        this.activeEditor.setDecorations(this.unfoldedDecorationType, this.unfoldedRanges);
        this.activeEditor.setDecorations(this.foldedDecorationType, this.foldedRanges);
    }

    public getFoldedRanges(): vscode.Range[] {
        return this.foldedRanges;
    }

    public findFoldedRangeAtPosition(position: vscode.Position): vscode.Range | undefined {
        const hitSlop = Decorator.foldedClickHitSlopChars;

        for (const range of this.foldedRanges) {
            if (range.contains(position)) {
                return range;
            }

            // Decorations are rendered around the range boundaries, so we accept near-boundary clicks.
            if (range.start.line === range.end.line) {
                if (
                    position.line === range.start.line &&
                    position.character >= Math.max(0, range.start.character - hitSlop) &&
                    position.character <= range.end.character + hitSlop
                ) {
                    return range;
                }
                continue;
            }

            if (
                position.line === range.start.line &&
                position.character >= Math.max(0, range.start.character - hitSlop) &&
                position.character <= range.start.character + hitSlop
            ) {
                return range;
            }

            if (
                position.line === range.end.line &&
                position.character >= Math.max(0, range.end.character - hitSlop) &&
                position.character <= range.end.character + hitSlop
            ) {
                return range;
            }

            if (position.line > range.start.line && position.line < range.end.line) {
                return range;
            }
        }

        return undefined;
    }

    public unfoldAndPositionCursor(range: vscode.Range) {
        if (!this.activeEditor) {
            return;
        }

        const text = this.activeEditor.document.getText(range);
        const lastQuoteMatch = text.match(/["'`](?=[^"'`]*$)/);

        if (lastQuoteMatch && lastQuoteMatch.index !== undefined) {
            const cursorOffset = this.activeEditor.document.offsetAt(range.start) + lastQuoteMatch.index;
            const cursorPosition = this.activeEditor.document.positionAt(cursorOffset);

            this.activeEditor.selection = new vscode.Selection(cursorPosition, cursorPosition);
            this.activeEditor.revealRange(
                new vscode.Range(cursorPosition, cursorPosition),
                vscode.TextEditorRevealType.InCenterIfOutsideViewport
            );
            this.updateDecorations();
        } else {
            this.activeEditor.selection = new vscode.Selection(range.end, range.end);
            this.updateDecorations();
        }
    }

    private isRangeSelected(range: vscode.Range): boolean {
        return !!(
            this.activeEditor!.selections.find((s) => s.intersection(range) !== undefined)
        );
    }

    private isLineOfRangeSelected(range: vscode.Range): boolean {
        return !!this.activeEditor!.selections.find((s) => s.start.line === range.start.line);
    }

    public dispose() {
        this.cancelScheduledReparse();
        this.unfoldedDecorationType?.dispose();
        this.foldedDecorationType?.dispose();
    }
}

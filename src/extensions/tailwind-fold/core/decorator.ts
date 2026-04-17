import * as vscode from "vscode";
import { Parser } from "./parser";
import { createFoldedDecorationType, createUnfoldedDecorationType } from "./decorations";
import * as Config from "./config";
import { Settings } from "./config";
import { StatusBar } from "../ui/status-bar";

export class Decorator {
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

    constructor(private context: vscode.ExtensionContext) {
        this.loadConfig().then(() => {
            this.setActiveEditor(vscode.window.activeTextEditor);
        });
    }

    public setActiveEditor(textEditor: vscode.TextEditor | undefined) {
        if (!textEditor) {
            return;
        }
        this.activeEditor = textEditor;
        this.recalculateMatches(); // Run RegEx only when document/editor changes
        this.updateDecorations();
    }

    public toggleAutoFold(): boolean {
        this.autoFold = !this.autoFold;
        Config.set(Settings.AutoFold, this.autoFold);
        StatusBar.update(this.autoFold);
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

        StatusBar.initialize();
        StatusBar.update(this.autoFold);

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
            return; // Do nothing for unsupported files
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

    private isRangeSelected(range: vscode.Range): boolean {
        return !!(
            this.activeEditor!.selections.find((s) => s.intersection(range) !== undefined)
        );
    }

    private isLineOfRangeSelected(range: vscode.Range): boolean {
        return !!this.activeEditor!.selections.find((s) => s.start.line === range.start.line);
    }

    public dispose() {
        this.unfoldedDecorationType?.dispose();
        this.foldedDecorationType?.dispose();
    }
}

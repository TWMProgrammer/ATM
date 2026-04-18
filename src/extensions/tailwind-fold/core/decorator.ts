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

    // Track auto-inserted space for cleanup if unused
    private autoInsertedSpace: { position: vscode.Position; line: number } | null = null;

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

    public unfoldAndPositionCursor(position: vscode.Position) {
        if (!this.activeEditor) {
            return;
        }

        // FIRST: Clean up any previous auto-inserted space before inserting a new one
        this.cleanupAutoInsertedSpace();

        // Find the folded range that contains this position
        for (const range of this.foldedRanges) {
            if (range.contains(position) || 
                (position.line === range.start.line && 
                 position.character >= range.start.character - 3 && 
                 position.character <= range.end.character + 3)) {
                
                // Get the text to find the closing quote
                const text = this.activeEditor.document.getText(range);
                
                // Find the last quote character (", ', or `)
                const lastQuoteMatch = text.match(/["'`](?=[^"'`]*$)/);
                
                if (lastQuoteMatch && lastQuoteMatch.index !== undefined) {
                    // Check if there's already a space before the closing quote
                    const charBeforeQuote = lastQuoteMatch.index > 0 ? text[lastQuoteMatch.index - 1] : '';
                    const needsSpace = charBeforeQuote !== ' ' && charBeforeQuote !== '\t';
                    
                    if (needsSpace) {
                        // Insert a space before the closing quote
                        const quoteOffset = this.activeEditor.document.offsetAt(range.start) + lastQuoteMatch.index;
                        const quotePosition = this.activeEditor.document.positionAt(quoteOffset);
                        
                        this.activeEditor.edit((editBuilder) => {
                            editBuilder.insert(quotePosition, ' ');
                        }).then(() => {
                            // Position cursor after the inserted space
                            const cursorPosition = this.activeEditor!.document.positionAt(quoteOffset + 1);
                            this.activeEditor!.selection = new vscode.Selection(cursorPosition, cursorPosition);
                            
                            // Track this auto-inserted space
                            this.autoInsertedSpace = { 
                                position: quotePosition, 
                                line: quotePosition.line 
                            };
                            
                            // Reveal the cursor position
                            this.activeEditor!.revealRange(
                                new vscode.Range(cursorPosition, cursorPosition),
                                vscode.TextEditorRevealType.InCenterIfOutsideViewport
                            );
                            
                            // Force update decorations to unfold
                            this.updateDecorations();
                        });
                    } else {
                        // Space already exists, just position cursor before the closing quote
                        const cursorOffset = this.activeEditor.document.offsetAt(range.start) + lastQuoteMatch.index;
                        const cursorPosition = this.activeEditor.document.positionAt(cursorOffset);
                        
                        this.autoInsertedSpace = null;
                        this.activeEditor.selection = new vscode.Selection(cursorPosition, cursorPosition);
                        
                        // Reveal the cursor position
                        this.activeEditor.revealRange(
                            new vscode.Range(cursorPosition, cursorPosition),
                            vscode.TextEditorRevealType.InCenterIfOutsideViewport
                        );
                        
                        // Force update decorations to unfold
                        this.updateDecorations();
                    }
                } else {
                    // Fallback: position at the end of the range
                    this.autoInsertedSpace = null;
                    this.activeEditor.selection = new vscode.Selection(range.end, range.end);
                    this.updateDecorations();
                }
                
                break;
            }
        }
    }

    private cleanupAutoInsertedSpace() {
        if (this.autoInsertedSpace && this.activeEditor) {
            const spacePos = this.autoInsertedSpace.position;
            
            // Verify the space still exists at that position
            const spaceRange = new vscode.Range(spacePos, spacePos.translate(0, 1));
            const charAtPos = this.activeEditor.document.getText(spaceRange);
            
            if (charAtPos === ' ') {
                // Remove the unused space synchronously
                this.activeEditor.edit((editBuilder) => {
                    editBuilder.delete(spaceRange);
                });
            }
            
            // Clear tracking regardless
            this.autoInsertedSpace = null;
        }
    }

    public onTextChanged(event: vscode.TextDocumentChangeEvent) {
        // If user typed on the same line as auto-inserted space, keep it
        if (this.autoInsertedSpace && event.contentChanges.length > 0) {
            for (const change of event.contentChanges) {
                if (change.range.start.line === this.autoInsertedSpace.line && change.text.length > 0) {
                    // User typed on the same line, mark space as "used"
                    this.autoInsertedSpace = null;
                    break;
                }
            }
        }
    }

    public onSelectionChanged() {
        // If user moved cursor away and didn't type anything, remove the auto-inserted space
        if (this.autoInsertedSpace && this.activeEditor) {
            const currentSelection = this.activeEditor.selection;
            
            // Check if cursor moved to a different line
            if (currentSelection.active.line !== this.autoInsertedSpace.line) {
                this.cleanupAutoInsertedSpace();
            }
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
        this.unfoldedDecorationType?.dispose();
        this.foldedDecorationType?.dispose();
    }
}

import * as vscode from "vscode";
import { Decorator } from "./core/decorator";
import { Settings } from "./core/config";
import { StatusBar } from "./ui/status-bar";
import { Icons } from "./ui/icons";
import { TailwindFoldHoverProvider } from "./ui/hover";

export async function activateTailwindFold(context: vscode.ExtensionContext) {
    Icons.initialize(context);
    StatusBar.initialize();

    const decorator = new Decorator(context);

    let hoverProvider: vscode.Disposable | undefined;

    const registerHoverProvider = () => {
        hoverProvider?.dispose();

        const supportedLangs = vscode.workspace
            .getConfiguration(Settings.Identifier)
            .get<string[]>(Settings.SupportedLanguages, ["html", "vue", "javascriptreact", "typescriptreact", "svelte", "astro"]);

        const selectors = supportedLangs.map((lang) => ({ language: lang }));
        hoverProvider = selectors.length > 0
            ? vscode.languages.registerHoverProvider(selectors, new TailwindFoldHoverProvider(decorator))
            : undefined;
    };

    // Register event handlers
    const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            decorator.setActiveEditor(editor);
        }
    });

    const changeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
            // Track if user typed on the line with auto-inserted space
            decorator.onTextChanged(event);
            
            decorator.recalculateMatches();
            decorator.updateDecorations();
        }
    });

    const changeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection((event) => {
        // Check if this is a click (single cursor, no selection)
        if (event.selections.length === 1 && event.selections[0].isEmpty) {
            const position = event.selections[0].active;
            
            // Check if the click was on a folded range
            const foldedRanges = decorator.getFoldedRanges();
            for (const range of foldedRanges) {
                // Check if click is within or near the folded decoration
                if (position.line === range.start.line &&
                    position.character >= range.start.character - 3 &&
                    position.character <= range.end.character + 3) {
                    
                    // Unfold and position cursor correctly
                    decorator.unfoldAndPositionCursor(position);
                    
                    // Update decorations and return early
                    decorator.updateDecorations();
                    return;
                }
            }
        }
        
        // Check if we need to remove auto-inserted space (user moved away without typing)
        decorator.onSelectionChanged();
        
        // Here we iterata cached ranges instead of full RegEx parse, increasing perf 100x vs legacy.
        decorator.updateDecorations();
    });

    const changeConfiguration = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration(Settings.Identifier)) {
            await decorator.loadConfig();

            if (event.affectsConfiguration(`${Settings.Identifier}.${Settings.SupportedLanguages}`)) {
                registerHoverProvider();
            }
        }
    });

    // Register commands
    const toggleCommand = vscode.commands.registerCommand("tailwind-fold.toggleAutoFold", () => {
        decorator.toggleAutoFold();
    });

    // Register Hover Provider
    registerHoverProvider();

    context.subscriptions.push(
        changeActiveTextEditor,
        changeTextDocument,
        changeTextEditorSelection,
        changeConfiguration,
        toggleCommand,
        { dispose: () => hoverProvider?.dispose() },
        { dispose: () => decorator.dispose() },
        { dispose: () => StatusBar.dispose() }
    );
}

export function deactivateTailwindFold() {
    StatusBar.dispose();
}

import * as vscode from "vscode";
import { Decorator } from "./core/decorator";
import * as Config from "./core/config";
import { Settings } from "./core/config";
import { Icons } from "./ui/icons";
import { TailwindFoldHoverProvider } from "./ui/hover";


const COMMAND_TOGGLE_AUTO_FOLD = "tailwind-css.toggleAutoFold";
const COMMAND_TOGGLE_ENABLED = "tailwind-css.toggleEnabled";
const DEFAULT_SUPPORTED_LANGUAGES = ["html", "vue", "javascriptreact", "typescriptreact", "svelte", "astro"];

export async function activateTailwindFold(context: vscode.ExtensionContext) {
    Icons.initialize(context);

    let decorator: Decorator | undefined;
    let lastActiveSelectionLine: number | undefined;
    let runtimeDisposables: vscode.Disposable[] = [];
    let isEnabled = Config.get<boolean>(Settings.Enabled, true);

    let hoverProvider: vscode.Disposable | undefined;

    const registerHoverProvider = () => {
        hoverProvider?.dispose();

        if (!decorator) {
            return;
        }

        const supportedLangs = vscode.workspace
            .getConfiguration(Settings.Identifier)
            .get<string[]>(Settings.SupportedLanguages, DEFAULT_SUPPORTED_LANGUAGES);

        const selectors = supportedLangs.map((lang) => ({ language: lang }));
        hoverProvider = selectors.length > 0
            ? vscode.languages.registerHoverProvider(selectors, new TailwindFoldHoverProvider(decorator))
            : undefined;
    };

    const stopRuntime = () => {
        for (const disposable of runtimeDisposables) {
            disposable.dispose();
        }

        runtimeDisposables = [];
        hoverProvider?.dispose();
        hoverProvider = undefined;
        decorator?.dispose();
        decorator = undefined;
        lastActiveSelectionLine = undefined;
    };

    const startRuntime = () => {
        if (decorator) {
            return;
        }

        decorator = new Decorator(context);

        // Register event handlers
        const changeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && decorator) {
                lastActiveSelectionLine = undefined;
                decorator.setActiveEditor(editor);
            }
        });

        const changeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
            if (!decorator) {
                return;
            }

            if (event.document === vscode.window.activeTextEditor?.document) {
                // Track if user typed on the line with auto-inserted space
                decorator.onTextChanged(event);

                // Debounce full parser execution while typing.
                decorator.scheduleReparseAndUpdate(300);
            }
        });

        const changeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection((event) => {
            if (!decorator) {
                return;
            }

            const activeLine = event.selections.length > 0 ? event.selections[0].active.line : undefined;

            // Check if this is a click (single cursor, no selection)
            if (event.selections.length === 1 && event.selections[0].isEmpty) {
                const position = event.selections[0].active;

                const clickedFoldedRange = decorator.findFoldedRangeAtPosition(position);
                if (clickedFoldedRange) {
                    // Unfold and position cursor correctly
                    decorator.unfoldAndPositionCursor(clickedFoldedRange);
                    lastActiveSelectionLine = activeLine;

                    // Update decorations and return early
                    decorator.updateDecorations();
                    return;
                }
            }

            // Check if we need to remove auto-inserted space (user moved away without typing)
            decorator.onSelectionChanged();

            // Skip expensive decoration refresh when cursor is still on the same line.
            if (activeLine === lastActiveSelectionLine) {
                return;
            }

            lastActiveSelectionLine = activeLine;

            // Here we iterata cached ranges instead of full RegEx parse, increasing perf 100x vs legacy.
            decorator.updateDecorations();
        });

        runtimeDisposables = [
            changeActiveTextEditor,
            changeTextDocument,
            changeTextEditorSelection
        ];

        registerHoverProvider();
    };

    const changeConfiguration = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration(Settings.Identifier)) {
            return;
        }

        const configuredEnabled = Config.get<boolean>(Settings.Enabled, true);
        const enabledChanged = configuredEnabled !== isEnabled;
        isEnabled = configuredEnabled;

        if (!isEnabled) {
            stopRuntime();
            return;
        }

        if (!decorator) {
            startRuntime();
        }

        if (!decorator) {
            return;
        }

        await decorator.loadConfig();

        if (event.affectsConfiguration(`${Settings.Identifier}.${Settings.SupportedLanguages}`)) {
            registerHoverProvider();
        }

        if (enabledChanged) {
            vscode.window.showInformationMessage("🔄 You need to refresh | Tailwind CSS enabled");
        }
    });

    // Register commands
    const toggleCommand = vscode.commands.registerCommand(COMMAND_TOGGLE_AUTO_FOLD, () => {
        if (!isEnabled || !decorator) {
            vscode.window.showInformationMessage("Tailwind CSS is disabled.");
            return;
        }

        decorator.toggleAutoFold();
    });

    const toggleEnabledCommand = vscode.commands.registerCommand(COMMAND_TOGGLE_ENABLED, async () => {
        const nextEnabled = !isEnabled;
        await Config.set(Settings.Enabled, nextEnabled);

        isEnabled = nextEnabled;
        if (isEnabled) {
            startRuntime();
            await decorator?.loadConfig();
            vscode.window.showInformationMessage("🔄 You need to refresh | Tailwind CSS enabled");
            return;
        }

        stopRuntime();
        vscode.window.showInformationMessage("Tailwind CSS disabled. You can enable it again from Settings.");
    });

    if (isEnabled) {
        startRuntime();
    }

    context.subscriptions.push(
        changeConfiguration,
        toggleCommand,
        toggleEnabledCommand,
        {
            dispose: () => {
                stopRuntime();
            }
        }
    );
}

export function deactivateTailwindFold() {
    // no-op
}

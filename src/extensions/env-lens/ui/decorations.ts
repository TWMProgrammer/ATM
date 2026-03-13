import * as vscode from 'vscode';

let blurDecorationType: vscode.TextEditorDecorationType;
let maskDecorationType: vscode.TextEditorDecorationType;
let isBlurEnabled = true;
const revealedKeys = new Set<string>();
const revealTimers = new Map<string, NodeJS.Timeout>();
const DEFAULT_REVEAL_MS = 5000;

type RenderMode = 'blur' | 'mask';

interface EnvLensUiConfig {
    renderMode: RenderMode;
    enableHoverReveal: boolean;
    ultraSecureMode: boolean;
}

export function registerEnvDecorations(context: vscode.ExtensionContext) {
    blurDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; filter: blur(4px); opacity: 0.8; transition: all 0.2s ease-in-out;',
        cursor: 'pointer',
    });

    maskDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; opacity: 0;',
        cursor: 'pointer',
    });

    const triggerDecorationsUpdate = debounce(() => updateDecorations(), 100);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            // Security-first: apply immediately on editor switch to avoid clear-text flash.
            updateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            // Debounce only typing updates for better performance.
            triggerDecorationsUpdate();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('atm.envLens')) {
            updateDecorations();
        }
    }, null, context.subscriptions);

    // Initial update
    if (vscode.window.activeTextEditor) {
        updateDecorations();
    }
}

function updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    applyDecorationsToEditor(editor);
}

function applyDecorationsToEditor(editor: vscode.TextEditor) {
    if (!editor) {
        return;
    }

    const config = getUiConfig();

    const fileName = editor.document.fileName.split(/[\\/]/).pop();

    // Only apply to .env files
    if (fileName !== '.env') {
        editor.setDecorations(blurDecorationType, []);
        editor.setDecorations(maskDecorationType, []);
        return;
    }

    if (!isBlurEnabled) {
        editor.setDecorations(blurDecorationType, []);
        editor.setDecorations(maskDecorationType, []);
        return;
    }

    const text = editor.document.getText();
    const ranges: vscode.DecorationOptions[] = [];

    // Match KEY=VALUE (where VALUE is what we want to blur)
    const envRegex = /^([^=#]+)=(.*?)$/gm;
    let match;

    while ((match = envRegex.exec(text))) {
        // match[1] = key
        // match[2] = value (this is what we blur)

        const key = match[1]?.trim();
        const value = match[2]?.trim();

        if (!key || !value) {
            continue;
        }

        if (revealedKeys.has(key)) {
            continue;
        }

        const valueStartPos = editor.document.positionAt(match.index + match[1].length + 1); // +1 for the =
        const valueEndPos = editor.document.positionAt(match.index + match[0].length);

        let hoverMessage: string | vscode.MarkdownString | undefined;

        if (!config.ultraSecureMode && config.enableHoverReveal) {
            const payload = encodeURIComponent(JSON.stringify({ key, value }));
            const md = new vscode.MarkdownString(
                `[👁️ Reveal this value for 3s](command:envLens.revealValue?${payload})`
            );
            md.isTrusted = true;
            hoverMessage = md;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(valueStartPos, valueEndPos),
            hoverMessage
        };

        if (config.renderMode === 'mask') {
            decoration.renderOptions = {
                after: {
                    contentText: '••••••',
                    color: 'rgba(128, 128, 128, 0.9)',
                    margin: '0 0 0 0'
                }
            };
        }

        ranges.push(decoration);
    }

    if (config.renderMode === 'mask') {
        editor.setDecorations(blurDecorationType, []);
        editor.setDecorations(maskDecorationType, ranges);
        return;
    }

    editor.setDecorations(maskDecorationType, []);
    editor.setDecorations(blurDecorationType, ranges);
}

export function revealKeyTemporarily(key: string, durationMs = DEFAULT_REVEAL_MS): void {
    if (!key) {
        return;
    }

    // If it's already revealed, ignore repeated clicks.
    // This guarantees it returns to blur after the original 5s.
    if (revealedKeys.has(key)) {
        return;
    }

    revealedKeys.add(key);
    refreshVisibleEditors();

    const timer = setTimeout(() => {
        revealedKeys.delete(key);
        revealTimers.delete(key);
        refreshVisibleEditors();
    }, durationMs);

    revealTimers.set(key, timer);
}

export function setBlurEnabled(enabled: boolean): void {
    isBlurEnabled = enabled;
    refreshVisibleEditors();
}

export function getBlurEnabled(): boolean {
    return isBlurEnabled;
}

function getUiConfig(): EnvLensUiConfig {
    const config = vscode.workspace.getConfiguration('atm.envLens');
    const renderModeRaw = config.get<string>('renderMode', 'blur');
    const renderMode: RenderMode = renderModeRaw === 'mask' ? 'mask' : 'blur';
    return {
        renderMode,
        enableHoverReveal: config.get<boolean>('enableHoverReveal', true),
        ultraSecureMode: config.get<boolean>('ultraSecureMode', false),
    };
}

function refreshVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
        applyDecorationsToEditor(editor);
    }
}

// Simple debounce utility for performance
function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

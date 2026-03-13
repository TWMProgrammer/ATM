import * as vscode from 'vscode';

let blurDecorationType: vscode.TextEditorDecorationType;
let isBlurEnabled = true;

export function registerEnvDecorations(context: vscode.ExtensionContext) {
    blurDecorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; filter: blur(4px); opacity: 0.8; transition: all 0.2s ease-in-out;',
        cursor: 'pointer',
    });

    const triggerDecorationsUpdate = debounce(() => updateDecorations(), 100);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            triggerDecorationsUpdate();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            triggerDecorationsUpdate();
        }
    }, null, context.subscriptions);

    // Initial update
    if (vscode.window.activeTextEditor) {
        triggerDecorationsUpdate();
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

    const fileName = editor.document.fileName.split(/[\\/]/).pop();

    // Only apply to .env files
    if (fileName !== '.env') {
        editor.setDecorations(blurDecorationType, []);
        return;
    }

    if (!isBlurEnabled) {
        editor.setDecorations(blurDecorationType, []);
        return;
    }

    const text = editor.document.getText();
    const blurRanges: vscode.DecorationOptions[] = [];

    // Match KEY=VALUE (where VALUE is what we want to blur)
    const envRegex = /^([^=#]+)=(.*?)$/gm;
    let match;

    while ((match = envRegex.exec(text))) {
        // match[1] = key
        // match[2] = value (this is what we blur)
        
        if (!match[2] || match[2].trim() === '') {
            continue;
        }

        const valueStartPos = editor.document.positionAt(match.index + match[1].length + 1); // +1 for the =
        const valueEndPos = editor.document.positionAt(match.index + match[0].length);

        const decoration = { 
            range: new vscode.Range(valueStartPos, valueEndPos), 
            hoverMessage: '👁️ Click to reveal value' 
        };
        blurRanges.push(decoration);
    }

    editor.setDecorations(blurDecorationType, blurRanges);
}

export function setBlurEnabled(enabled: boolean): void {
    isBlurEnabled = enabled;
    for (const editor of vscode.window.visibleTextEditors) {
        applyDecorationsToEditor(editor);
    }
}

export function getBlurEnabled(): boolean {
    return isBlurEnabled;
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

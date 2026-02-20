import * as vscode from 'vscode';
import { checkText } from '../core/engine';
import { spellDecorationType } from '../ui/styles';

export const spellDiagnostics =
  vscode.languages.createDiagnosticCollection('code-spell');

// Map to control timeouts per opened document (Debounce per Document)
const debounceTimers = new Map<string, NodeJS.Timeout>();

// The delay (ms) determines how long to wait after typing before analyzing new text.
const DEBOUNCE_DELAY = 400;

/**
 * Intelligently schedules the execution of the spelling check.
 * It will only run if the user stops typing for DEBOUNCE_DELAY ms.
 */
export function scheduleDiagnosticsCheck(doc: vscode.TextDocument) {
  if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
    return;
  }

  // Only analyze source code or text files, ignore consoles or .git
  const validModes = [
    'typescript',
    'javascript',
    'javascriptreact',
    'typescriptreact',
    'html',
    'css',
    'json',
    'plaintext',
    'markdown',
    'python',
    'java',
    'c',
    'cpp',
    'csharp',
  ];
  if (!validModes.includes(doc.languageId)) {
    return;
  }

  const key = doc.uri.toString();
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key)!);
  }

  const timer = setTimeout(() => {
    performCheck(doc);
    debounceTimers.delete(key);
  }, DEBOUNCE_DELAY);

  debounceTimers.set(key, timer);
}

/**
 * Clears diagnostics if a document is closed.
 */
export function clearDiagnostics(doc: vscode.TextDocument) {
  spellDiagnostics.delete(doc.uri);
  const key = doc.uri.toString();
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key)!);
    debounceTimers.delete(key);
  }
}

/**
 * Executes the analysis using the main engine non-blockingly,
 * relying on its extreme lightness to avoid affecting the Main UI Thread.
 */
function performCheck(doc: vscode.TextDocument) {
  const text = doc.getText();

  // Engine call
  const issues = checkText(text);

  const ranges: vscode.Range[] = [];

  const diagnostics: vscode.Diagnostic[] = issues.map((issue) => {
    // vscode.TextDocument helps transform Offsets to Line/Column Ranges
    const start = doc.positionAt(issue.offset);
    const end = doc.positionAt(issue.offset + issue.length);
    const range = new vscode.Range(start, end);

    ranges.push(range);

    // Information severity instead of Error to avoid alerting the Problems Tab unnecessarily
    const diag = new vscode.Diagnostic(
      range,
      `Unknown word: "${issue.word}" (ATM Code Spell)`,
      vscode.DiagnosticSeverity.Hint,
    );

    diag.source = 'ATM code-spell';
    return diag;
  });

  spellDiagnostics.set(doc.uri, diagnostics);

  // Apply our custom UI styles over the words directly
  // Handles multiple split-screen editors showing the same document
  vscode.window.visibleTextEditors
    .filter((e) => e.document.uri.toString() === doc.uri.toString())
    .forEach((editor) => {
      editor.setDecorations(spellDecorationType, ranges);
    });
}

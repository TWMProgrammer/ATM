import * as vscode from 'vscode';
import { checkText } from '../core/engine';
import { spellDecorationType } from '../ui/styles';
import { shouldIgnoreFile, SUPPORTED_LANGUAGES } from '../core/exclusions';

export const spellDiagnostics =
  vscode.languages.createDiagnosticCollection('code-spell');

// Map to control timeouts per opened document (Debounce per Document)
const debounceTimers = new Map<string, NodeJS.Timeout>();

// The delay (ms) determines how long to wait after typing before analyzing new text.
const DEBOUNCE_DELAY = 400;

/* =========================================================
 * ⏳ SCHEDULE DIAGNOSTICS CHECK
 * Intelligently schedules the execution of the spelling check.
 * It will only run if the user stops typing for DEBOUNCE_DELAY ms.
 * ========================================================= */
export function scheduleDiagnosticsCheck(doc: vscode.TextDocument) {
  if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
    return;
  }

  // Only analyze languages where spell-checking is useful
  if (!SUPPORTED_LANGUAGES.has(doc.languageId)) {
    return;
  }

  // Skip files in ignored folders, lockfiles, minified, declarations, etc.
  if (shouldIgnoreFile(doc.uri.fsPath)) {
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

/* =========================================================
 * 🧹 CLEAR DIAGNOSTICS
 * Clears diagnostics if a document is closed.
 * ========================================================= */
export function clearDiagnostics(doc: vscode.TextDocument) {
  spellDiagnostics.delete(doc.uri);
  const key = doc.uri.toString();
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key)!);
    debounceTimers.delete(key);
  }
}

/* =========================================================
 * 🚀 PERFORM CHECK
 * Executes the analysis using the main engine non-blockingly,
 * relying on its extreme lightness to avoid affecting the Main UI Thread.
 * ========================================================= */
function performCheck(doc: vscode.TextDocument) {
  const text = doc.getText();

  // Engine call
  const issues = checkText(text);

  const ranges: vscode.Range[] = [];
  const diagnostics: vscode.Diagnostic[] = [];

  /* =========================================================
   * 1️⃣ GET CRITICAL PROBLEMS
   * Get current critical problems (TS, ESLint, etc.) to prioritize them
   * ========================================================= */
  const existingDiagnostics = vscode.languages
    .getDiagnostics(doc.uri)
    .filter(
      (d) =>
        d.source !== 'ATM code-spell' &&
        d.severity <= vscode.DiagnosticSeverity.Warning,
    );

  issues.forEach((issue) => {
    // vscode.TextDocument helps transform Offsets to Line/Column Ranges
    const start = doc.positionAt(issue.offset);
    const end = doc.positionAt(issue.offset + issue.length);
    const range = new vscode.Range(start, end);

    /* =========================================================
     * 2️⃣ AVOID OVERLAP
     * If the spelling error collides with a critical code error, we ignore it to give it visual priority (e.g. Error Lens)
     * ========================================================= */
    const isOverlapping = existingDiagnostics.some((d) =>
      d.range.intersection(range),
    );

    if (isOverlapping) {
      return; // Skip this issue
    }

    ranges.push(range);

    // Information severity instead of Error to avoid alerting the Problems Tab unnecessarily
    const diag = new vscode.Diagnostic(
      range,
      `Unknown word: "${issue.word}" (ATM Code Spell)`,
      vscode.DiagnosticSeverity.Hint,
    );

    diag.source = 'ATM code-spell';
    diagnostics.push(diag);
  });

  spellDiagnostics.set(doc.uri, diagnostics);

  /* =========================================================
   * 💅 APPLY CUSTOM STYLES
   * Apply our custom UI styles over the words directly
   * Handles multiple split-screen editors showing the same document
   * ========================================================= */
  vscode.window.visibleTextEditors
    .filter((e) => e.document.uri.toString() === doc.uri.toString())
    .forEach((editor) => {
      editor.setDecorations(spellDecorationType, ranges);
    });
}

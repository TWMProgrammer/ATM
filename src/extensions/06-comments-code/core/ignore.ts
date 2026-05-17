import * as vscode from 'vscode';

const EXCLUDED_FILE_NAMES = new Set([
  '.gitignore',
  '.prettierignore',
  '.eslintignore',
  '.stylelintignore',
  '.npmignore',
  '.dockerignore',
  '.vscodeignore',
  '.hgignore',
  '.ignore',
]);

const DOT_IGNORE_FILE_PATTERN = /^\.{1,2}[\w.-]*ignore$/i;

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  const rawName = slashIdx >= 0 ? normalized.substring(slashIdx + 1) : normalized;
  return rawName.toLowerCase();
}

export function shouldExcludeDocument(document: vscode.TextDocument): boolean {
  const fileName = getBaseName(document.fileName);
  if (!fileName) {
    return false;
  }

  return (
    EXCLUDED_FILE_NAMES.has(fileName)
    || DOT_IGNORE_FILE_PATTERN.test(fileName)
  );
}

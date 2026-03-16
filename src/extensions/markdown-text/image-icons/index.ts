import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 🎨 IMAGE ICONS PROVIDER
 * This provider enables rich file icons in the autocomplete list when typing paths
 * inside <img> tags or Markdown image syntax in .md and .mdx files.
 *
 * It fixes the issue where VS Code shows generic icons for files in Markdown.
 */

// Regex to detect if cursor is in an image source context
// Group 1: HTML <img src="..."> context
// Group 2: Markdown ![alt](...) context
const IMG_SRC_REGEX = /<img\s+[^>]*src\s*=\s*["']([^"']*)$|!\[[^\]]*\]\(([^)]*)$/i;

class MarkdownImageIconProvider implements vscode.CompletionItemProvider {
  /**
   * Provide completion items for file paths with correct Icons.
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | undefined> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const match = linePrefix.match(IMG_SRC_REGEX);

    if (!match) {
      return undefined;
    }

    // Extract the path typed so far
    const typedPath = match[1] || match[2] || '';

    // Resolve the current directory and the search directory
    const docUri = document.uri;
    const docDir = path.dirname(docUri.fsPath);
    let searchDir: string;

    try {
      if (typedPath.includes('/') || typedPath.includes('\\')) {
        const lastSeparator = Math.max(typedPath.lastIndexOf('/'), typedPath.lastIndexOf('\\'));
        const dirPart = typedPath.substring(0, lastSeparator + 1);

        // Handle absolute paths (relative to workspace root if it starts with /)
        if (typedPath.startsWith('/')) {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
          if (workspaceFolder) {
            searchDir = path.resolve(workspaceFolder.uri.fsPath, dirPart.substring(1));
          } else {
            searchDir = path.resolve(docDir, dirPart);
          }
        } else {
          searchDir = path.resolve(docDir, dirPart);
        }
      } else {
        searchDir = docDir;
      }

      // Verify search directory exists
      if (!fs.existsSync(searchDir)) {
        return undefined;
      }

      // Read directory contents
      const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });

      return entries
        .filter((entry) => !entry.name.startsWith('.')) // Skip hidden files/folders
        .map((entry) => {
          const isDir = entry.isDirectory();
          const kind = isDir ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File;

          const item = new vscode.CompletionItem(entry.name, kind);

          // If it's a directory, add a trailing slash and trigger next suggestion
          if (isDir) {
            item.insertText = entry.name + '/';
            item.command = {
              command: 'editor.action.triggerSuggest',
              title: 'Re-trigger suggestions',
            };
          }

          // Sort folders first
          item.sortText = `${isDir ? 'a' : 'b'}_${entry.name}`;

          return item;
        });
    } catch (error) {
      // Fail silently to not disturb the user experience
      return undefined;
    }
  }
}

/**
 * 🔌 ACTIVATE
 */
export function activateMarkdownImageIcons(context: vscode.ExtensionContext): void {
  const provider = new MarkdownImageIconProvider();

  // Register for both markdown and mdx
  const selectors = [
    { scheme: 'file', language: 'markdown' },
    { scheme: 'file', language: 'mdx' },
  ];

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selectors,
      provider,
      '/',
      '\\',
      '(',
      '"',
      "'"
    )
  );
}

import * as vscode from 'vscode';
import { envParser } from '../core/env-parser';

export class EnvHoverProvider implements vscode.HoverProvider {
    /**
     * Regexes to match `process.env.XXX` or `import.meta.env.XXX`
     */
    private envRegex = /(?:process\.env\.|import\.meta\.env\.)([a-zA-Z0-9_]+)/g;

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position, this.envRegex);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        const match = this.envRegex.exec(word);

        // Reset regex state since it's global
        this.envRegex.lastIndex = 0;

        if (match && match[1]) {
            const key = match[1];
            const value = envParser.getValue(key);

            if (value !== undefined) {
                // Obfuscate value by default
                const obfuscated = value.length > 4 
                    ? `${value.substring(0, 2)}••••••••••••${value.substring(value.length - 2)}`
                    : '••••';

                const md = new vscode.MarkdownString();
                
                // Add the actual text, using markdown to create a minimal UI block
                md.appendMarkdown(`**Env Lens** 👁️\n\n`);
                md.appendCodeblock(`${key} = ${obfuscated}`, 'env');
                
                // Add command link
                md.appendMarkdown(`\n\n[👁️ Reveal for 3s](command:envLens.revealValue?${encodeURIComponent(JSON.stringify(key))})`);

                md.isTrusted = true;
                return new vscode.Hover(md, range);
            }
        }

        return null;
    }
}

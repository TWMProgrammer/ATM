import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class EnvParser {
    private envCache: Map<string, string> = new Map();
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    /**
     * Cache the parsed key-value pairs of all `.env*` files in the current workspace.
     */
    public async initialize(context: vscode.ExtensionContext) {
        // Read initially
        await this.loadAllEnvFiles();

        // Setup watcher
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/.env*');

        this.fileWatcher.onDidChange(this.handleEnvChange, this);
        this.fileWatcher.onDidCreate(this.handleEnvChange, this);
        this.fileWatcher.onDidDelete(this.handleEnvChange, this);

        context.subscriptions.push(this.fileWatcher);
    }

    private async loadAllEnvFiles() {
        const uris = await vscode.workspace.findFiles('**/.env*', '**/node_modules/**');
        this.envCache.clear();

        for (const uri of uris) {
            this.parseAndCache(uri);
        }
    }

    private handleEnvChange(uri: vscode.Uri) {
        this.parseAndCache(uri);
    }

    private parseAndCache(uri: vscode.Uri) {
        try {
            if (!fs.existsSync(uri.fsPath)) {
                return;
            }
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                // Ignore comments and empty lines
                if (!trimmed || trimmed.startsWith('#')) {
                    continue;
                }

                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    
                    // Simple quote stripping
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    this.envCache.set(key, value);
                }
            }
        } catch (error) {
            console.error(`Error parsing env file at ${uri.fsPath}:`, error);
        }
    }

    /**
     * Get a value from the env cache
     */
    public getValue(key: string): string | undefined {
        return this.envCache.get(key);
    }
    
    /**
     * Check if key exists
     */
    public hasKey(key: string): boolean {
        return this.envCache.has(key);
    }

    public dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        this.envCache.clear();
    }
}

export const envParser = new EnvParser();

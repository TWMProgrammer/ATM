import * as vscode from 'vscode';

export interface DependencyInfo {
    name: string;
    currentVersion: string;
    line: number; // 0-indexed
    range: vscode.Range;
}

export function parsePackageJson(document: vscode.TextDocument): DependencyInfo[] {
    const text = document.getText();
    const dependencies: DependencyInfo[] = [];
    
    let inDependencyBlock = false;
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        
        /* =========================================================
         * 📥 ENTER DEPENDENCY BLOCKS
         * ========================================================= */
        if (lineText.match(/"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:/)) {
            inDependencyBlock = true;
            continue;
        }
        
        /* =========================================================
         * 📤 EXIT BLOCK
         * Detect simple closures for safety
         * ========================================================= */
        if (inDependencyBlock && lineText.match(/^\s*}/)) {
            inDependencyBlock = false;
            continue;
        }
        
        /* =========================================================
         * 📦 INSIDE DEPENDENCY BLOCK
         * ========================================================= */
        if (inDependencyBlock) {
            const match = lineText.match(/"([^"]+)"\s*:\s*"([^"]+)"/);
            if (match) {
                const name = match[1];
                const version = match[2];
                /* =========================================================
                 * 🚫 EXCLUDE DEPENDENCIES
                 * Exclude workspace, local git, or null dependencies
                 * ========================================================= */
                if (!version.startsWith('file:') && !version.startsWith('github:') && !version.startsWith('workspace:')) {
                    const startPos = lineText.indexOf(match[0]);
                    dependencies.push({
                        name,
                        currentVersion: version,
                        line: i,
                        range: new vscode.Range(i, startPos, i, startPos + match[0].length)
                    });
                }
            }
        }
    }
    
    return dependencies;
}

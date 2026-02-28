import * as vscode from 'vscode';
import { GitService } from './git-service';
import { timeAgo, formatDate, getGravatarUrl, debounce, LRUCache } from './utils';

const MAX_HOVER_CACHE = 200;

export class LineBlameDecorator implements vscode.Disposable {
    private decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 3em',
            textDecoration: ';opacity:0.55;font-size:0.9em;',
        },
        isWholeLine: false,
    });

    private activeEditor: vscode.TextEditor | undefined;
    private disposables: vscode.Disposable[] = [];
    private hoverCache = new LRUCache<string, vscode.MarkdownString>(MAX_HOVER_CACHE);
    private enabled = true;
    private updateVersion = 0; // Monotonic counter for stale-check

    constructor(private gitService: GitService) {
        const debouncedUpdate = debounce(this.updateDecoration.bind(this), 120);

        const onSelectionChange = (e: vscode.TextEditorSelectionChangeEvent) => {
            if (this.activeEditor && e.textEditor === this.activeEditor) {
                // Instantly clear the old blame decoration to avoid a 120ms "flicker" of old data
                this.activeEditor.setDecorations(this.decorationType, []);
            }
            debouncedUpdate();
        };

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChanged.bind(this)),
            vscode.window.onDidChangeTextEditorSelection(onSelectionChange),
            { dispose: debouncedUpdate.cancel },
        );

        if (vscode.window.activeTextEditor) {
            this.onActiveEditorChanged(vscode.window.activeTextEditor);
        }
    }

    /** Toggle inline blame on/off. */
    public toggleEnabled(): boolean {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.activeEditor?.setDecorations(this.decorationType, []);
        } else {
            this.updateDecoration();
        }
        return this.enabled;
    }

    /** Notify that a file's blame data may have changed. */
    public invalidateHoverCache(): void {
        this.hoverCache.clear();
    }

    private async onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
        this.activeEditor = editor;
        if (!editor || editor.document.uri.scheme !== 'file') { return; }

        // Asynchronously update blame when editor changes, doesn't block UI
        this.gitService.blameFile(editor.document.uri.fsPath).then(() => {
            if (this.activeEditor === editor) {
                this.updateDecoration();
            }
        });
        this.updateDecoration();
    }

    public async updateDecoration() {
        if (!this.enabled) { return; }

        const editor = this.activeEditor;
        if (!editor || editor.document.uri.scheme !== 'file') { return; }

        const version = ++this.updateVersion;
        const activeLine = editor.selection.active.line;
        const filePath = editor.document.uri.fsPath;

        // Skip rendering blame on visually empty lines to avoid awkward/misplaced hovers
        const lineText = editor.document.lineAt(activeLine).text;
        if (lineText.trim().length === 0) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        try {
            const blameInfo = this.gitService.getBlameLineInfo(filePath, activeLine + 1);
            const commitInfo = blameInfo
                ? this.gitService.getCommitInfo(blameInfo.commitHash)
                : null;

            if (!commitInfo) {
                editor.setDecorations(this.decorationType, []);
                return;
            }

            if (commitInfo.hash === '0000000000000000000000000000000000000000') {
                editor.setDecorations(this.decorationType, []);
                return;
            }

            const summaryText =
                commitInfo.summary.length > 50
                    ? commitInfo.summary.substring(0, 47) + '...'
                    : commitInfo.summary;
            const text = `  ${timeAgo(commitInfo.date)}  •  ${summaryText}`;

            const color = new vscode.ThemeColor('editorCodeLens.foreground');
            const border = 'none';

            let mdBase = this.hoverCache.get(commitInfo.hash);

            if (!mdBase) {
                mdBase = await this.buildHoverMarkdown(commitInfo, filePath);
                this.hoverCache.set(commitInfo.hash, mdBase);
            }

            // Stale check after potential await
            if (this.updateVersion !== version) { return; }

            // Clone the cached markdown string so we can safely add the line diff
            const finalMd = new vscode.MarkdownString(mdBase.value, true);
            finalMd.isTrusted = true;
            finalMd.supportHtml = true;

            // Append line diff dynamically since diffs are per-line, not per-commit
            if (blameInfo) {
                const diff = await this.gitService.getLineDiff(
                    filePath,
                    commitInfo.hash,
                    blameInfo.originalLine
                );

                // Stale check after second await
                if (this.updateVersion !== version) { return; }

                if (diff && (diff.previous !== null || diff.current !== null)) {
                    finalMd.appendMarkdown(`\n\n\`\`\`diff\n`);
                    if (diff.previous !== null) {
                        finalMd.appendMarkdown(`- ${diff.previous}\n`);
                    }
                    if (diff.current !== null) {
                        finalMd.appendMarkdown(`+ ${diff.current}\n`);
                    }
                    finalMd.appendMarkdown(`\`\`\`\n`);
                }
            }

            // Final stale check
            if (this.updateVersion !== version) { return; }

            const lineEnd = editor.document.lineAt(activeLine).range.end;
            editor.setDecorations(this.decorationType, [
                {
                    range: new vscode.Range(lineEnd, lineEnd),
                    hoverMessage: finalMd,
                    renderOptions: {
                        after: {
                            contentText: text,
                            color: color,
                            border: border,
                        },
                    },
                },
            ]);
        } catch (error) {
            console.error('[git-better] Failed to update blame decoration:', error);
            editor.setDecorations(this.decorationType, []);
        }
    }

    /** Builds the hover markdown for a given commit. */
    private async buildHoverMarkdown(
        commitInfo: { hash: string; authorName: string; authorEmail: string; date: Date; summary: string },
        filePath: string
    ): Promise<vscode.MarkdownString> {
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportHtml = true;

        const avatarUrl = getGravatarUrl(commitInfo.authorEmail, 48);
        const dateStr = formatDate(commitInfo.date);
        const relativeStr = timeAgo(commitInfo.date);
        const escapeMd = (t: string) =>
            t.replace(/([\\\`*_{}[\]()#+\-.!|])/g, '\\$1');

        md.appendMarkdown(
            `**${escapeMd(commitInfo.authorName)}** &nbsp;$(history) _${relativeStr}_ &nbsp;•&nbsp; _${dateStr}_\n\n`
        );
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(
            `<img src="${avatarUrl}" width="28" height="28" style="background-color:transparent;border:0;border-radius:50%;" /> &nbsp;$(git-commit) &nbsp;<span style="color:#cecece;">${escapeMd(commitInfo.summary)}</span>\n\n`
        );
        md.appendMarkdown(`---\n\n`);

        const previousHash = await this.gitService.getPreviousCommitHash(
            filePath,
            commitInfo.hash
        );
        const shortHash = commitInfo.hash.substring(0, 7);
        const copyBtn = `[${shortHash} $(copy)](command:git-better.copyHash?%22${commitInfo.hash}%22 "Copy Commit Hash")`;

        let changesStr = `**Changes** &nbsp;&nbsp;$(git-commit) ${copyBtn}`;
        if (previousHash) {
            changesStr += ` &nbsp;$(arrow-swap)&nbsp; \`${previousHash.substring(0, 7)}\``;
        }
        changesStr += ` &nbsp;|&nbsp; $(github) [Open on GitHub](command:git-better.openGitHub?%22${commitInfo.hash}%22 "Open on GitHub")`;

        md.appendMarkdown(changesStr);

        return md;
    }

    public dispose() {
        this.activeEditor?.setDecorations(this.decorationType, []);
        this.decorationType.dispose();
        this.disposables.forEach((d) => d.dispose());
    }
}

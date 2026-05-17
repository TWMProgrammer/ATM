import * as vscode from 'vscode';
import { TemplateBuilder } from './template';
import { Messaging } from './messaging';
import { GraphGitService } from './git-service';

/**
 * WebviewViewProvider for the Git Graph Panel.
 *
 * Thin coordinator that wires up the webview and delegates:
 *  - HTML generation  → TemplateBuilder
 *  - Message routing  → Messaging
 */
export class GraphPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gitlab.graphView';

    private readonly template: TemplateBuilder;
    private readonly messaging: Messaging;

    constructor(private readonly extensionUri: vscode.Uri) {
        this.template = new TemplateBuilder(extensionUri);
        this.messaging = new Messaging();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.template.build(webviewView.webview);

        const msgDisposable = this.messaging.attach(webviewView.webview);
        const readyDisposable = webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'ready') {
                this.sendInitialData(webviewView.webview);
            }
            if (msg.type === 'loadMoreCommits') {
                this.sendCommitPage(webviewView.webview, msg.skip || 0, msg.limit || 25);
            }
            if (msg.type === 'selectCommit' && msg.hash) {
                this.sendCommitDetail(webviewView.webview, msg.hash);
            }
        });

        webviewView.onDidDispose(() => {
            msgDisposable.dispose();
            readyDisposable.dispose();
        });
    }

    private async sendInitialData(webview: vscode.Webview) {
        // Send initial Inspect panel data
        const latestCommit = await GraphGitService.getLatestCommit();
        if (latestCommit) {
            webview.postMessage({
                type: 'renderCommit',
                data: latestCommit
            });
        }

        // Send graphics timeline data
        const timeline = await GraphGitService.getGraphicsTimeline(30);
        if (timeline) {
            webview.postMessage({
                type: 'renderGraphics',
                data: timeline
            });
        }

        // Send global stats (left sidebar)
        const stats = await GraphGitService.getGlobalStats();
        if (stats) {
            webview.postMessage({
                type: 'renderStats',
                data: stats
            });
        }

        // Send first page of commits
        await this.sendCommitPage(webview, 0, 25);
    }

    private async sendCommitPage(webview: vscode.Webview, skip: number, limit: number) {
        const commits = await GraphGitService.getCommitPage(skip, limit);
        webview.postMessage({
            type: 'renderCommits',
            data: commits || [],
            skip,
            hasMore: (commits?.length || 0) === limit,
        });
    }

    private async sendCommitDetail(webview: vscode.Webview, hash: string) {
        const commitData = await GraphGitService.getCommitByHash(hash);
        if (commitData) {
            webview.postMessage({
                type: 'renderCommit',
                data: commitData
            });
        }
    }
}

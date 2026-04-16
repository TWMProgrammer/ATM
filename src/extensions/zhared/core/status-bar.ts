import * as vscode from 'vscode';

let globalStatusBarItem: vscode.StatusBarItem;

export interface ToolState {
    id: string;          
    name: string;        
    icon: string;        
    command: string;     
    description?: string; 
}

const toolRegistry = new Map<string, ToolState>();

export function activateGlobalStatusBar(context: vscode.ExtensionContext) {
    if (globalStatusBarItem) { return; }
    globalStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
    globalStatusBarItem.text = '$(verified-filled) ATM';
    
    // Dummy command for hover/pointer styles
    const ACTION_COMMAND = 'atm.global.statusClicked';
    context.subscriptions.push(
        vscode.commands.registerCommand(ACTION_COMMAND, () => {
            // Suggestion: In the future, this could open a quick-pick menu
        }),
        vscode.commands.registerCommand('atm.layout.normal', async () => {
            const config = vscode.workspace.getConfiguration('workbench');
            await config.update('sideBar.location', 'left', vscode.ConfigurationTarget.Global);
            await config.update('activityBar.location', 'default', vscode.ConfigurationTarget.Global);
        }),
        vscode.commands.registerCommand('atm.layout.pro', async () => {
            const config = vscode.workspace.getConfiguration('workbench');
            await config.update('sideBar.location', 'right', vscode.ConfigurationTarget.Global);
            await config.update('activityBar.location', 'top', vscode.ConfigurationTarget.Global);
        })
    );
    globalStatusBarItem.command = ACTION_COMMAND;
    
    context.subscriptions.push(
        globalStatusBarItem,
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('workbench.sideBar.location') || e.affectsConfiguration('workbench.activityBar.location')) {
                renderHoverUI();
            }
        })
    );
    globalStatusBarItem.show();

    renderHoverUI();
}

export function updateToolState(state: ToolState) {
    toolRegistry.set(state.id, state);
    renderHoverUI();
}

export function removeToolState(id: string) {
    toolRegistry.delete(id);
    renderHoverUI();
}

function renderHoverUI() {
    if (!globalStatusBarItem) { return; }

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true; 
    md.supportThemeIcons = true;
    md.supportHtml = true;

    // Header - Ultra Clean
    md.appendMarkdown('### **ATM**\n\n');

    if (toolRegistry.size === 0) {
        md.appendMarkdown('_No active tools_\n\n');
    } else {
        for (const [_, state] of toolRegistry) {
            const desc = state.description ? ` <span style="color:#888888;">— ${state.description}</span>` : '';
            md.appendMarkdown(`${state.icon} &nbsp; **[${state.name}](command:${state.command})** ${desc}\n\n`);
        }
    }

    md.appendMarkdown('<hr>\n\n');
    
    const settings = vscode.workspace.getConfiguration('workbench');
    const isPro = settings.get('sideBar.location') === 'right';
    
    // Modern indicator marks
    const normalItem = !isPro ? `$(pass-filled) **Normal**` : `$(circle-outline) [Normal](command:atm.layout.normal)`;
    const proItem = isPro ? `$(pass-filled) **Pro**` : `$(circle-outline) [Pro](command:atm.layout.pro)`;
    
    md.appendMarkdown(`Layout &nbsp;&nbsp; ${normalItem} &nbsp; | &nbsp; ${proItem}\n\n`);

    md.appendMarkdown('<hr>\n\n');
    
    // Requested Footer - Minimalist Steel Blue & Grey
    md.appendMarkdown(`<sub><span style="color:#569CD6;">$(pulse)</span> <span style="color:#888888;">Core systems online and monitoring.</span></sub>`);

    globalStatusBarItem.tooltip = md;

    // Minimalist Status Bar Text
    globalStatusBarItem.text = `$(verified-filled) ATM`;
    
    // Optional: Subtle color change when active tools exist
    if (toolRegistry.size > 0) {
        globalStatusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    } else {
        globalStatusBarItem.color = undefined;
    }
}

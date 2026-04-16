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
    
    context.subscriptions.push(globalStatusBarItem);
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

    // Ultra minimalist UI
    md.appendMarkdown('**ATM Tools**\n\n');
    md.appendMarkdown('__Layout:__ &nbsp; $(remote-explorer) [Normal](command:atm.layout.normal) &nbsp;|&nbsp; $(layout-sidebar-right) [Pro](command:atm.layout.pro)\n\n---\n\n');

    if (toolRegistry.size === 0) {
        md.appendMarkdown('_No tools active_');
    } else {
        for (const [_, state] of toolRegistry) {
            const desc = state.description ? ` *(${state.description})*` : '';
            md.appendMarkdown(`${state.icon} &nbsp;[${state.name}](command:${state.command})${desc}\n\n`);
        }
    }

    globalStatusBarItem.tooltip = md;
}

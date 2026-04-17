import * as vscode from 'vscode';
import { 
    RenderContext, 
    ToolState, 
    CONSTANTS, 
    getToolStats, 
    organizeToolsByCategory,
    escapeMarkdown,
    applyLayout,
    cycleFaahAudio
} from './utils';

/**
 * Renders the minimal tooltip for the status bar
 * Shows only essential information in a compact format
 */
export function renderMinimalTooltip(
    statusBarItem: vscode.StatusBarItem, 
    context: RenderContext
): void {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    md.supportHtml = true;

    const stats = getToolStats();
    const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[context.currentFaahAudioIndex];

    // Simple header
    md.appendMarkdown('### **ATM**\n\n');
    md.appendMarkdown('---\n\n');

    // Tools - Top 5 only, no categories
    if (context.toolRegistry.size === 0) {
        md.appendMarkdown('$(info) &nbsp; _No active tools_\n\n');
    } else {
        const allTools = Array.from(context.toolRegistry.values())
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 5);

        for (const tool of allTools) {
            const keybinding = tool.keybinding 
                ? ` <sub><span style="color:#569CD6;">[${tool.keybinding}]</span></sub>` 
                : '';
            
            md.appendMarkdown(
                `${tool.icon} &nbsp; **[${escapeMarkdown(tool.name)}](command:${tool.command} "${escapeMarkdown(tool.description || 'Execute ' + tool.name)}")**${keybinding}\n\n`
            );
        }

        if (stats.totalTools > 5) {
            const remaining = stats.totalTools - 5;
            md.appendMarkdown(
                `<sub><span style="color:#888888;">$(ellipsis) ${remaining} more tool${remaining !== 1 ? 's' : ''}</span></sub>\n\n`
            );
        }
    }

    md.appendMarkdown('---\n\n');

    // Layout - Simple indicator
    const normalIcon = !context.isPro ? '$(pass-filled)' : '$(circle-outline)';
    const proIcon = context.isPro ? '$(pass-filled)' : '$(circle-outline)';
    
    const normalItem = !context.isPro 
        ? `${normalIcon} <span style="color:#4EC9B0;">**Normal**</span>` 
        : `${normalIcon} [Normal](command:${CONSTANTS.COMMANDS.LAYOUT_NORMAL})`;
    const proItem = context.isPro 
        ? `${proIcon} <span style="color:#4EC9B0;">**Pro**</span>` 
        : `${proIcon} [Pro](command:${CONSTANTS.COMMANDS.LAYOUT_PRO})`;

    md.appendMarkdown(`**Layout:** &nbsp; ${normalItem} &nbsp; $(chevron-right) &nbsp; ${proItem}\n\n`);

    // Audio - Simple indicator
    md.appendMarkdown(
        `**Error Audio:** &nbsp; [${currentAudio.icon} ${currentAudio.name}](command:${CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO}) &nbsp; $(chevron-right) &nbsp; [$(play) Test](command:${CONSTANTS.COMMANDS.FAAH_TEST_AUDIO})\n\n`
    );

    md.appendMarkdown('---\n\n');

    // Footer with expand button - aligned properly
    const statusColor = stats.totalTools > 0 ? '#4EC9B0' : '#888888';
    const statusIcon = stats.totalTools > 0 ? '$(pulse)' : '$(circle-outline)';
    const statusText = stats.totalTools > 0 ? 'All systems operational' : 'Awaiting tool activation';
    
    md.appendMarkdown(
        `<span style="color:${statusColor};">${statusIcon} ${statusText}</span>`
    );
    
    // Add expand button on the right side
    const spacing = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
    md.appendMarkdown(`${spacing}[$(unfold)](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Expand")`);

    statusBarItem.tooltip = md;
}

/**
 * Shows the minimal quick menu
 * Displays essential actions and tools in a simplified format
 */
export async function showMinimalQuickMenu(context: RenderContext): Promise<void> {
    const stats = getToolStats();
    const items: vscode.QuickPickItem[] = [];

    // Header
    items.push({ 
        label: `$(verified-filled) ATM Control Center`, 
        kind: vscode.QuickPickItemKind.Separator 
    });

    // Quick Actions
    items.push({ label: '$(zap) Quick Actions', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: `$(expand-all) Expand Mode`,
        description: 'Show detailed view',
        detail: 'Switch to advanced mode with full information',
        alwaysShow: true
    });
    items.push({
        label: `$(refresh) Refresh`,
        description: `${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''}`,
        detail: 'Reload all tool states',
        alwaysShow: true
    });

    // Layout
    items.push({ label: '$(layout) Layout', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: !context.isPro ? '$(pass-filled) Normal' : '$(circle-outline) Normal',
        description: !context.isPro ? 'Active' : 'Click to activate',
        alwaysShow: true
    });
    items.push({
        label: context.isPro ? '$(pass-filled) Pro' : '$(circle-outline) Pro',
        description: context.isPro ? 'Active' : 'Click to activate',
        alwaysShow: true
    });

    // Audio
    items.push({ label: '$(unmute) Error Audio', kind: vscode.QuickPickItemKind.Separator });
    for (let i = 0; i < CONSTANTS.FAAH_AUDIO_OPTIONS.length; i++) {
        const audio = CONSTANTS.FAAH_AUDIO_OPTIONS[i];
        const isActive = i === context.currentFaahAudioIndex;
        items.push({
            label: isActive ? `$(pass-filled) ${audio.icon} ${audio.name}` : `$(circle-outline) ${audio.icon} ${audio.name}`,
            description: isActive ? 'Active' : '',
            alwaysShow: true
        });
    }
    items.push({
        label: `$(play) Test Audio`,
        description: `Preview ${CONSTANTS.FAAH_AUDIO_OPTIONS[context.currentFaahAudioIndex].name}`,
        alwaysShow: true
    });

    // Tools - Top 10
    if (context.toolRegistry.size > 0) {
        items.push({ label: `$(tools) Tools (${stats.totalTools})`, kind: vscode.QuickPickItemKind.Separator });

        const allTools = Array.from(context.toolRegistry.values())
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 10);

        for (const tool of allTools) {
            const keybinding = tool.keybinding ? ` $(keyboard) ${tool.keybinding}` : '';
            items.push({
                label: `${tool.icon} ${tool.name}${keybinding}`,
                description: tool.description,
                detail: `$(terminal) ${tool.command}`
            });
        }

        if (stats.totalTools > 10) {
            items.push({
                label: `$(info) ${stats.totalTools - 10} more tools available`,
                description: 'Switch to expanded mode to see all'
            });
        }
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = '$(search) Search...';
    quickPick.title = `$(verified-filled) ATM — ${stats.totalTools} Tool${stats.totalTools !== 1 ? 's' : ''}`;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (!selected) {
            quickPick.dispose();
            return;
        }

        quickPick.dispose();
        await handleMinimalSelection(selected, context);
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}

/**
 * Handles selection from the minimal quick menu
 */
async function handleMinimalSelection(
    selected: vscode.QuickPickItem, 
    context: RenderContext
): Promise<void> {
    try {
        // Mode toggle
        if (selected.label.includes('Expand Mode')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT);
        }
        // Refresh
        else if (selected.label.includes('Refresh')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS);
        }
        // Layout
        else if (selected.label.includes('Normal') && selected.label.includes('Layout') === false) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL);
        } else if (selected.label.includes('Pro') && selected.label.includes('Layout') === false) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_PRO);
        }
        // Audio
        else if (selected.label.includes('Test Audio')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_TEST_AUDIO);
        } else if (selected.detail?.includes('Error audio theme:') || 
                   (selected.label.match(/Faah|ACK|Fatality|Windows/) && !selected.label.includes('Test'))) {
            const audioName = selected.label.replace(/\$\([^)]+\)\s*/g, '').trim();
            const audioOption = CONSTANTS.FAAH_AUDIO_OPTIONS.find(a => a.name === audioName);
            if (audioOption) {
                const audioIndex = CONSTANTS.FAAH_AUDIO_OPTIONS.indexOf(audioOption);
                if (audioIndex !== context.currentFaahAudioIndex) {
                    await cycleFaahAudio();
                }
            }
        }
        // Tool execution
        else if (selected.detail?.startsWith('$(terminal) ')) {
            const cmd = selected.detail.replace('$(terminal) ', '').trim();
            if (cmd) {
                await vscode.commands.executeCommand(cmd);
            }
        }
    } catch (error) {
        console.error('[ATM] Error executing command:', error);
        vscode.window.showErrorMessage(`$(error) ATM: Failed to execute command`);
    }
}

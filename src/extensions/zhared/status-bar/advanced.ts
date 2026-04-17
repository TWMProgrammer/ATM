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
 * Renders the advanced tooltip for the status bar
 * Shows comprehensive information with rich formatting
 */
export function renderAdvancedTooltip(
    statusBarItem: vscode.StatusBarItem, 
    context: RenderContext
): void {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    md.supportHtml = true;

    const stats = getToolStats();
    const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[context.currentFaahAudioIndex];

    // Rich header
    md.appendMarkdown('### **ATM** <span style="color:#888888;">Control Center</span>\n\n');
    md.appendMarkdown(
        `<sub><span style="color:#9370DB;">Advanced Tool Management System</span></sub>\n\n`
    );
    md.appendMarkdown('---\n\n');

    // Status with stats
    if (stats.totalTools > 0) {
        md.appendMarkdown('**Status:** ');
        md.appendMarkdown(
            `<span style="color:#4EC9B0;">$(check) ${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active</span>\n\n`
        );
    }

    // Tools organized by category
    if (context.toolRegistry.size === 0) {
        md.appendMarkdown('$(info) &nbsp; _No active tools detected_\n\n');
        md.appendMarkdown('<sub>Tools will appear here when activated</sub>\n\n');
    } else {
        const toolsByCategory = organizeToolsByCategory();
        let toolCount = 0;
        const maxToolsToShow = 10;

        for (const [category, tools] of toolsByCategory) {
            if (toolCount >= maxToolsToShow) {
                const remaining = stats.totalTools - toolCount;
                md.appendMarkdown(
                    `\n<sub><span style="color:#888888;">$(ellipsis) ${remaining} more tool${remaining !== 1 ? 's' : ''} available</span></sub>\n\n`
                );
                break;
            }

            const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || 
                                 CONSTANTS.CATEGORIES.other;
            md.appendMarkdown(`**${categoryInfo.icon} ${categoryInfo.label}**\n\n`);

            const sortedTools = tools
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .slice(0, maxToolsToShow - toolCount);

            for (const state of sortedTools) {
                const desc = state.description 
                    ? ` <span style="color:#808080;">— ${escapeMarkdown(state.description)}</span>` 
                    : '';
                const keybinding = state.keybinding
                    ? ` <sub><span style="color:#569CD6;">[${state.keybinding}]</span></sub>`
                    : '';
                
                md.appendMarkdown(
                    `${state.icon} &nbsp; **[${escapeMarkdown(state.name)}](command:${state.command} "${escapeMarkdown(state.description || 'Execute ' + state.name)}")**${keybinding}${desc}\n\n`
                );
                toolCount++;
            }

            if (toolCount < maxToolsToShow) {
                md.appendMarkdown('\n');
            }
        }
    }

    md.appendMarkdown('---\n\n');

    // Layout with visual indicators
    const normalIcon = !context.isPro ? '$(pass-filled)' : '$(circle-outline)';
    const proIcon = context.isPro ? '$(pass-filled)' : '$(circle-outline)';
    
    const normalItem = !context.isPro 
        ? `${normalIcon} <span style="color:#4EC9B0;">**Normal**</span>` 
        : `${normalIcon} [Normal](command:${CONSTANTS.COMMANDS.LAYOUT_NORMAL} "Switch to Normal Layout")`;
    const proItem = context.isPro 
        ? `${proIcon} <span style="color:#4EC9B0;">**Pro**</span>` 
        : `${proIcon} [Pro](command:${CONSTANTS.COMMANDS.LAYOUT_PRO} "Switch to Pro Layout")`;

    md.appendMarkdown(`**Layout:** &nbsp; ${normalItem} &nbsp; $(chevron-right) &nbsp; ${proItem}\n\n`);

    // Audio with test button
    const muteIcon = context.isFaahEnabled ? '$(unmute)' : '$(mute)';
    const audioStatus = context.isFaahEnabled ? 'Mute' : 'Unmute';
    
    if (context.isFaahEnabled) {
        md.appendMarkdown(
            `**T-Sound:** &nbsp; [${currentAudio.icon} <span style="color:#CE9178;">${currentAudio.name}</span>](command:${CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO} "Cycle audio theme") &nbsp; $(chevron-right) &nbsp; [$(play) Test](command:${CONSTANTS.COMMANDS.FAAH_TEST_AUDIO} "Test current audio") &nbsp; <span style="color:#888888;">l</span> &nbsp; [${muteIcon}](command:${CONSTANTS.COMMANDS.FAAH_TOGGLE_MUTE} "${audioStatus} Audio")\n\n`
        );
    } else {
        md.appendMarkdown(
            `**T-Sound:** &nbsp; <span style="color:#888888;">${currentAudio.icon} ${currentAudio.name} &nbsp; $(chevron-right) &nbsp; $(play) Test</span> &nbsp; <span style="color:#888888;">l</span> &nbsp; [${muteIcon} Muted](command:${CONSTANTS.COMMANDS.FAAH_TOGGLE_MUTE} "${audioStatus} Audio")\n\n`
        );
    }

    md.appendMarkdown('---\n\n');

    // Quick Actions with GitHub link
    md.appendMarkdown(
        `[$(github) GitHub](https://github.com/bastndev/ATM "Open ATM repository") &nbsp; l &nbsp; `
    );
    md.appendMarkdown(
        `[$(refresh) Refresh](command:${CONSTANTS.COMMANDS.REFRESH_TOOLS} "Reload all tools") &nbsp; l &nbsp; `
    );
    md.appendMarkdown(
        `[$(collapse-all) Compact](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Switch to compact mode")\n\n`
    );
    md.appendMarkdown('---\n\n');

    // Footer with status
    const statusColor = stats.totalTools > 0 ? '#4EC9B0' : '#888888';
    const statusIcon = stats.totalTools > 0 ? '$(pulse)' : '$(circle-outline)';
    const statusText = stats.totalTools > 0 
        ? 'All systems operational' 
        : 'Awaiting tool activation';

    md.appendMarkdown(
        `<sub><span style="color:${statusColor};">${statusIcon} ${statusText}</span></sub>`
    );

    statusBarItem.tooltip = md;
}

/**
 * Shows the advanced quick menu
 * Displays comprehensive options with detailed information
 */
export async function showAdvancedQuickMenu(context: RenderContext): Promise<void> {
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
        label: `$(refresh) Refresh Tools`,
        description: `${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active`,
        detail: 'Reload all tool states and update display',
        alwaysShow: true
    });
    items.push({
        label: `$(collapse-all) Compact Mode`,
        description: 'Minimize display',
        detail: 'Switch to compact mode for minimal display',
        alwaysShow: true
    });

    // Audio Section - All options visible
    items.push({ label: '$(unmute) Error Audio Themes', kind: vscode.QuickPickItemKind.Separator });
    
    items.push({
        label: context.isFaahEnabled ? '$(mute) Mute Audio' : '$(unmute) Unmute Audio',
        description: context.isFaahEnabled ? 'Click to silence errors' : 'Click to enable errors',
        detail: 'Toggles the FAAH extension globally',
        alwaysShow: true
    });

    if (context.isFaahEnabled) {
        for (let i = 0; i < CONSTANTS.FAAH_AUDIO_OPTIONS.length; i++) {
            const audio = CONSTANTS.FAAH_AUDIO_OPTIONS[i];
            const isActive = i === context.currentFaahAudioIndex;
            items.push({
                label: isActive ? `$(pass-filled) ${audio.icon} ${audio.name}` : `$(circle-outline) ${audio.icon} ${audio.name}`,
                description: isActive ? 'Currently active' : 'Click to activate',
                detail: `Error audio theme: ${audio.name}`,
                alwaysShow: true
            });
        }
        
        items.push({
            label: `$(play) Test Current Audio`,
            description: `Preview ${CONSTANTS.FAAH_AUDIO_OPTIONS[context.currentFaahAudioIndex].name}`,
            detail: 'Play the currently selected error audio',
            alwaysShow: true
        });
    }

    // Layout Section
    items.push({ label: '$(layout) Workspace Layouts', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: !context.isPro ? '$(pass-filled) Normal Layout' : '$(circle-outline) Normal Layout',
        description: CONSTANTS.LAYOUTS.NORMAL.description,
        detail: !context.isPro ? '✓ Currently active' : 'Click to activate this layout',
        alwaysShow: true
    });
    items.push({
        label: context.isPro ? '$(pass-filled) Pro Layout' : '$(circle-outline) Pro Layout',
        description: CONSTANTS.LAYOUTS.PRO.description,
        detail: context.isPro ? '✓ Currently active' : 'Click to activate this layout',
        alwaysShow: true
    });

    // Tools Section - Organized by category
    if (context.toolRegistry.size > 0) {
        const toolsByCategory = organizeToolsByCategory();
        
        for (const [category, tools] of toolsByCategory) {
            const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || 
                                 CONSTANTS.CATEGORIES.other;
            
            items.push({ 
                label: `${categoryInfo.icon} ${categoryInfo.label} (${tools.length})`, 
                kind: vscode.QuickPickItemKind.Separator 
            });

            const sortedTools = tools.sort((a, b) => {
                const priorityDiff = (b.priority || 0) - (a.priority || 0);
                return priorityDiff !== 0 ? priorityDiff : a.name.localeCompare(b.name);
            });

            for (const state of sortedTools) {
                const keybinding = state.keybinding ? ` $(keyboard) ${state.keybinding}` : '';
                const priorityBadge = state.priority && state.priority > 5 ? ' $(star-full)' : '';
                items.push({
                    label: `${state.icon} ${state.name}${priorityBadge}${keybinding}`,
                    description: state.description,
                    detail: `$(terminal) ${state.command}`,
                    buttons: [{
                        iconPath: new vscode.ThemeIcon('info'),
                        tooltip: 'Show detailed tool information'
                    }]
                });
            }
        }
    } else {
        items.push({ label: '$(inbox) No Active Tools', kind: vscode.QuickPickItemKind.Separator });
        items.push({
            label: '$(info) No tools detected',
            description: 'Waiting for tool activation',
            detail: 'Extensions will register their tools automatically when activated'
        });
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = '$(search) Search tools, layouts, audio themes, and actions...';
    quickPick.title = `$(verified-filled) ATM Control Center — ${stats.totalTools} Active Tool${stats.totalTools !== 1 ? 's' : ''}`;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.canSelectMany = false;

    quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (!selected) {
            quickPick.dispose();
            return;
        }

        quickPick.dispose();
        await handleAdvancedSelection(selected, context);
    });

    quickPick.onDidTriggerItemButton(async (e) => {
        const tool = Array.from(context.toolRegistry.values()).find(t => 
            e.item.label.includes(t.name)
        );
        if (tool) {
            await showToolInfo(tool);
        }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}

/**
 * Handles selection from the advanced quick menu
 */
async function handleAdvancedSelection(
    selected: vscode.QuickPickItem,
    context: RenderContext
): Promise<void> {
    try {
        // Layout selections
        if (selected.label.includes('Normal Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL);
        } else if (selected.label.includes('Pro Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_PRO);
        } 
        // Quick actions
        else if (selected.label.includes('Refresh Tools')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS);
            vscode.window.showInformationMessage('✓ ATM: Tools refreshed successfully');
        } else if (selected.label.includes('Compact Mode')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT);
        } 
        // Audio selections
        else if (selected.label.includes('Test Current Audio')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_TEST_AUDIO);
        } else if (selected.label.includes('Mute Audio') || selected.label.includes('Unmute Audio')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_TOGGLE_MUTE);
        } else if (selected.detail?.includes('Error audio theme:')) {
            const audioName = selected.label.replace(/\$\([^)]+\)\s*/g, '').trim();
            const audioOption = CONSTANTS.FAAH_AUDIO_OPTIONS.find(a => a.name === audioName);
            if (audioOption) {
                const audioIndex = CONSTANTS.FAAH_AUDIO_OPTIONS.indexOf(audioOption);
                if (audioIndex !== context.currentFaahAudioIndex) {
                    await cycleFaahAudio();
                }
            }
        }
        // Tool executions
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

/**
 * Shows detailed information about a tool
 */
async function showToolInfo(tool: ToolState): Promise<void> {
    const categoryInfo = CONSTANTS.CATEGORIES[tool.category as keyof typeof CONSTANTS.CATEGORIES] || 
                         CONSTANTS.CATEGORIES.other;
    
    const message = [
        `${tool.icon} **${tool.name}**`,
        '',
        tool.description || '_No description available_',
        '',
        '---',
        '',
        `**Command:** \`${tool.command}\``,
        tool.keybinding ? `**Keybinding:** \`${tool.keybinding}\`` : '',
        `**Category:** ${categoryInfo.icon} ${categoryInfo.label}`,
        tool.priority !== undefined ? `**Priority:** ${tool.priority}` : '',
        '',
        '_Click Execute to run this tool or Copy Command to copy the command to clipboard_'
    ].filter(Boolean).join('\n');

    const action = await vscode.window.showInformationMessage(
        message,
        { modal: false },
        '$(play) Execute',
        '$(copy) Copy Command',
        '$(info) More Info'
    );

    if (action === '$(play) Execute') {
        try {
            await vscode.commands.executeCommand(tool.command);
            vscode.window.showInformationMessage(`✓ Executed: ${tool.name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`✗ Failed to execute: ${tool.name}`);
        }
    } else if (action === '$(copy) Copy Command') {
        await vscode.env.clipboard.writeText(tool.command);
        vscode.window.showInformationMessage(`✓ Command copied to clipboard`);
    } else if (action === '$(info) More Info') {
        const outputChannel = vscode.window.createOutputChannel('ATM Tool Info');
        outputChannel.clear();
        outputChannel.appendLine(`=== ${tool.name} ===`);
        outputChannel.appendLine('');
        outputChannel.appendLine(`ID: ${tool.id}`);
        outputChannel.appendLine(`Name: ${tool.name}`);
        outputChannel.appendLine(`Command: ${tool.command}`);
        outputChannel.appendLine(`Category: ${tool.category || 'other'}`);
        outputChannel.appendLine(`Priority: ${tool.priority || 0}`);
        if (tool.keybinding) {
            outputChannel.appendLine(`Keybinding: ${tool.keybinding}`);
        }
        if (tool.description) {
            outputChannel.appendLine('');
            outputChannel.appendLine('Description:');
            outputChannel.appendLine(tool.description);
        }
        outputChannel.show();
    }
}

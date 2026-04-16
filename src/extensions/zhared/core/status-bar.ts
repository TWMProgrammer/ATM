import * as vscode from 'vscode';

let globalStatusBarItem: vscode.StatusBarItem | undefined;
let renderDebounceTimer: NodeJS.Timeout | undefined;
let isCompactMode = false;

/**
 * Represents the state of a tool registered in the ATM status bar
 */
export interface ToolState {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly command: string;
    readonly description?: string;
    readonly category?: 'productivity' | 'debugging' | 'ui' | 'analysis' | 'other';
    readonly priority?: number; // Higher = shown first
    readonly keybinding?: string;
}

/**
 * Layout configuration for the workbench
 */
interface LayoutConfig {
    readonly sideBarLocation: 'left' | 'right';
    readonly activityBarLocation: 'default' | 'top';
    readonly displayName: string;
    readonly description: string;
}

/**
 * Statistics about tool usage
 */
interface ToolStats {
    totalTools: number;
    activeTools: number;
    categoryCounts: Map<string, number>;
}

/**
 * FAAH Audio configuration
 */
interface FaahAudioOption {
    readonly id: string;
    readonly name: string;
    readonly fileName: string;
    readonly icon: string;
}

// Constants
const CONSTANTS = {
    STATUS_BAR_PRIORITY: 95,
    STATUS_BAR_TEXT: '$(verified-filled) ATM',
    DEBOUNCE_DELAY: 150, // ms
    COMMANDS: {
        STATUS_CLICKED: 'atm.global.statusClicked',
        LAYOUT_NORMAL: 'atm.layout.normal',
        LAYOUT_PRO: 'atm.layout.pro',
        TOGGLE_COMPACT: 'atm.toggleCompactMode',
        REFRESH_TOOLS: 'atm.refreshTools',
        FAAH_CYCLE_AUDIO: 'atm.faah.cycleAudio',
        FAAH_TEST_AUDIO: 'atm.faah.testAudio'
    },
    LAYOUTS: {
        NORMAL: { 
            sideBarLocation: 'left', 
            activityBarLocation: 'default',
            displayName: 'Normal Layout',
            description: 'Classic IDE layout with sidebar on left'
        } as LayoutConfig,
        PRO: { 
            sideBarLocation: 'right', 
            activityBarLocation: 'top',
            displayName: 'Pro Layout',
            description: 'Optimized for wide screens with top activity bar'
        } as LayoutConfig
    },
    FAAH_AUDIO_OPTIONS: [
        { id: 'faah', name: 'Error Audio', fileName: 'faah.wav', icon: '$(unmute)' },
        { id: 'ack', name: 'ACK', fileName: 'ack.wav', icon: '$(pulse)' },
        { id: 'fatality', name: 'Fatality', fileName: 'fatality.wav', icon: '$(flame)' },
        { id: 'windows', name: 'Windows', fileName: 'windows.wav', icon: '$(window)' }
    ] as FaahAudioOption[],
    CATEGORIES: {
        productivity: { icon: '$(rocket)', label: 'Productivity' },
        debugging: { icon: '$(bug)', label: 'Debugging' },
        ui: { icon: '$(paintcan)', label: 'UI/UX' },
        analysis: { icon: '$(graph)', label: 'Analysis' },
        other: { icon: '$(tools)', label: 'Other' }
    }
} as const;

const toolRegistry = new Map<string, ToolState>();
let lastRenderedHash: string | undefined;
let currentFaahAudioIndex = 0; // Index of current FAAH audio option

/**
 * Activates the global ATM status bar with all commands and event listeners
 * @param context - The extension context for registering disposables
 */
export function activateGlobalStatusBar(context: vscode.ExtensionContext): void {
    if (globalStatusBarItem) { 
        console.warn('[ATM] Status bar already activated');
        return; 
    }

    try {
        globalStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            CONSTANTS.STATUS_BAR_PRIORITY
        );
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;
        globalStatusBarItem.command = CONSTANTS.COMMANDS.STATUS_CLICKED;
        globalStatusBarItem.accessibilityInformation = {
            label: 'ATM Control Center - Click to open menu',
            role: 'button'
        };

        // Load compact mode preference
        isCompactMode = context.globalState.get('atm.compactMode', false);
        
        // Load FAAH audio preference
        currentFaahAudioIndex = context.globalState.get('atm.faah.audioIndex', 0);

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.STATUS_CLICKED, handleStatusBarClick),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL, () => applyLayout(CONSTANTS.LAYOUTS.NORMAL)),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_PRO, () => applyLayout(CONSTANTS.LAYOUTS.PRO)),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT, () => toggleCompactMode(context)),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS, () => {
                scheduleRender();
            }),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO, () => cycleFaahAudio(context)),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.FAAH_TEST_AUDIO, () => testFaahAudio(context))
        );

        // Register configuration change listener
        context.subscriptions.push(
            globalStatusBarItem,
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('workbench.sideBar.location') || 
                    e.affectsConfiguration('workbench.activityBar.location')) {
                    scheduleRender();
                }
            })
        );

        globalStatusBarItem.show();
        renderHoverUI();
        // Animation disabled for better performance
        // playActivationAnimation();

        console.log('[ATM] Status bar activated successfully');
    } catch (error) {
        console.error('[ATM] Failed to activate status bar:', error);
    }
}

/**
 * Registers or updates a tool in the status bar registry
 * @param state - The tool state to register
 * @throws Error if state is invalid
 */
export function updateToolState(state: ToolState): void {
    if (!isValidToolState(state)) {
        console.error('[ATM] Invalid tool state:', state);
        throw new Error(`Invalid tool state: missing required fields`);
    }

    const isNewTool = !toolRegistry.has(state.id);
    toolRegistry.set(state.id, state);
    scheduleRender();
    
    if (isNewTool) {
        // Animation disabled for better performance
        // playToolRegistrationAnimation();
        console.log(`[ATM] Tool registered: ${state.name} (${state.id})`);
    } else {
        console.log(`[ATM] Tool updated: ${state.name} (${state.id})`);
    }
}

/**
 * Removes a tool from the status bar registry
 * @param id - The tool ID to remove
 */
export function removeToolState(id: string): void {
    if (!id || typeof id !== 'string') {
        console.warn('[ATM] Invalid tool ID for removal:', id);
        return;
    }

    const tool = toolRegistry.get(id);
    const removed = toolRegistry.delete(id);
    if (removed) {
        scheduleRender();
        console.log(`[ATM] Tool removed: ${id}`);
    }
}

/**
 * Handles status bar click event - opens the quick pick menu
 */
async function handleStatusBarClick(): Promise<void> {
    try {
        await showQuickMenu();
    } catch (error) {
        console.error('[ATM] Error showing quick menu:', error);
    }
}

/**
 * Shows the ATM control center quick pick menu with enhanced UI
 */
async function showQuickMenu(): Promise<void> {
    const isPro = checkIsPro();
    const stats = getToolStats();
    const items: vscode.QuickPickItem[] = [];

    // Header with stats - No icon, ATM highlighted
    items.push({ 
        label: `ATM Control Center`, 
        kind: vscode.QuickPickItemKind.Separator 
    });

    // Quick Actions Section
    items.push({ label: 'Quick Actions', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: `$(refresh) Refresh Tools`,
        description: `${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active`,
        detail: 'Reload all tool states and update display',
        alwaysShow: true
    });
    items.push({
        label: isCompactMode ? '$(expand-all) Expand Mode' : '$(collapse-all) Compact Mode',
        description: 'Toggle status bar display mode',
        detail: isCompactMode ? 'Show detailed tooltips' : 'Minimize tooltip information',
        alwaysShow: true
    });

    // FAAH Audio Section
    const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
    items.push({ label: 'Error Audio', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: `${currentAudio.icon} ${currentAudio.name}`,
        description: 'Current error audio theme',
        detail: 'Click to cycle through available audio options',
        alwaysShow: true
    });

    // Layout Section
    items.push({ label: 'Workspace Layouts', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: !isPro ? '$(pass-filled) Normal Layout' : '$(circle-outline) Normal Layout',
        description: CONSTANTS.LAYOUTS.NORMAL.description,
        detail: !isPro ? 'Currently active' : 'Click to activate',
        alwaysShow: true
    });
    items.push({
        label: isPro ? '$(pass-filled) Pro Layout' : '$(circle-outline) Pro Layout',
        description: CONSTANTS.LAYOUTS.PRO.description,
        detail: isPro ? 'Currently active' : 'Click to activate',
        alwaysShow: true
    });

    // Tools Section - Organized by category
    if (toolRegistry.size > 0) {
        const toolsByCategory = organizeToolsByCategory();
        
        for (const [category, tools] of toolsByCategory) {
            const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || 
                                 CONSTANTS.CATEGORIES.other;
            
            items.push({ 
                label: `${categoryInfo.icon} ${categoryInfo.label}`, 
                kind: vscode.QuickPickItemKind.Separator 
            });

            // Sort tools by priority (higher first) then by name
            const sortedTools = tools.sort((a, b) => {
                const priorityDiff = (b.priority || 0) - (a.priority || 0);
                return priorityDiff !== 0 ? priorityDiff : a.name.localeCompare(b.name);
            });

            for (const state of sortedTools) {
                const keybinding = state.keybinding ? ` [${state.keybinding}]` : '';
                items.push({
                    label: `${state.icon} ${state.name}${keybinding}`,
                    description: state.description,
                    detail: `Execute: ${state.command}`,
                    buttons: [{
                        iconPath: new vscode.ThemeIcon('info'),
                        tooltip: 'Tool Information'
                    }]
                });
            }
        }
    } else {
        items.push({ label: 'No Active Tools', kind: vscode.QuickPickItemKind.Separator });
        items.push({
            label: '$(info) No tools detected',
            description: 'Tools will appear here when activated',
            detail: 'Extensions register tools automatically'
        });
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.placeholder = 'Search tools, layouts, and actions...';
    quickPick.title = `ATM Control Center — ${stats.totalTools} Active Tool${stats.totalTools !== 1 ? 's' : ''}`;
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
        await handleQuickPickSelection(selected);
    });

    quickPick.onDidTriggerItemButton(async (e) => {
        // Handle info button clicks
        const tool = Array.from(toolRegistry.values()).find(t => 
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
 * Handles selection from the quick pick menu
 */
async function handleQuickPickSelection(selected: vscode.QuickPickItem): Promise<void> {
    try {
        if (selected.label.includes('Normal Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL);
        } else if (selected.label.includes('Pro Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_PRO);
        } else if (selected.label.includes('Refresh Tools')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS);
        } else if (selected.label.includes('Compact Mode') || selected.label.includes('Expand Mode')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT);
        } else if (selected.description === 'Current error audio theme') {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO);
        } else if (selected.detail?.startsWith('Execute: ')) {
            const cmd = selected.detail.replace('Execute: ', '').trim();
            if (cmd) {
                await vscode.commands.executeCommand(cmd);
            }
        }
    } catch (error) {
        console.error('[ATM] Error executing command:', error);
    }
}

/**
 * Applies a layout configuration to the workbench with visual feedback
 * @param layout - The layout configuration to apply
 */
async function applyLayout(layout: LayoutConfig): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('workbench');
        
        // Show progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Applying ${layout.displayName}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            
            await Promise.all([
                config.update('sideBar.location', layout.sideBarLocation, vscode.ConfigurationTarget.Global),
                config.update('activityBar.location', layout.activityBarLocation, vscode.ConfigurationTarget.Global)
            ]);
            
            progress.report({ increment: 100 });
            await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for visual feedback
        });

        // Animation disabled for better performance
        // playLayoutChangeAnimation();
        
        console.log(`[ATM] Layout applied: ${layout.displayName}`);
    } catch (error) {
        console.error('[ATM] Failed to apply layout:', error);
    }
}

/**
 * Checks if the current layout is "Pro" mode
 * @returns true if Pro layout is active
 */
function checkIsPro(): boolean {
    try {
        const settings = vscode.workspace.getConfiguration('workbench');
        const sideBarPos = settings.get<string>('sideBar.location');
        const activityBarPos = settings.get<string>('activityBar.location');
        
        return sideBarPos === 'right' && activityBarPos === 'top';
    } catch (error) {
        console.error('[ATM] Error checking layout:', error);
        return false;
    }
}

/**
 * Validates a ToolState object
 * @param state - The state to validate
 * @returns true if valid
 */
function isValidToolState(state: any): state is ToolState {
    return (
        state &&
        typeof state === 'object' &&
        typeof state.id === 'string' && state.id.length > 0 &&
        typeof state.name === 'string' && state.name.length > 0 &&
        typeof state.icon === 'string' && state.icon.length > 0 &&
        typeof state.command === 'string' && state.command.length > 0 &&
        (state.description === undefined || typeof state.description === 'string') &&
        (state.category === undefined || ['productivity', 'debugging', 'ui', 'analysis', 'other'].includes(state.category)) &&
        (state.priority === undefined || typeof state.priority === 'number') &&
        (state.keybinding === undefined || typeof state.keybinding === 'string')
    );
}

/**
 * Gets statistics about registered tools
 */
function getToolStats(): ToolStats {
    const categoryCounts = new Map<string, number>();
    
    for (const tool of toolRegistry.values()) {
        const category = tool.category || 'other';
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    }

    return {
        totalTools: toolRegistry.size,
        activeTools: toolRegistry.size,
        categoryCounts
    };
}

/**
 * Organizes tools by category
 */
function organizeToolsByCategory(): Map<string, ToolState[]> {
    const organized = new Map<string, ToolState[]>();
    
    for (const tool of toolRegistry.values()) {
        const category = tool.category || 'other';
        if (!organized.has(category)) {
            organized.set(category, []);
        }
        organized.get(category)!.push(tool);
    }

    // Sort categories by priority
    const categoryOrder = ['productivity', 'debugging', 'ui', 'analysis', 'other'];
    const sorted = new Map<string, ToolState[]>();
    
    for (const cat of categoryOrder) {
        if (organized.has(cat)) {
            sorted.set(cat, organized.get(cat)!);
        }
    }

    return sorted;
}

/**
 * Shows detailed information about a tool
 */
async function showToolInfo(tool: ToolState): Promise<void> {
    const message = [
        `**${tool.name}**`,
        '',
        tool.description || 'No description available',
        '',
        `**Command:** \`${tool.command}\``,
        tool.keybinding ? `**Keybinding:** \`${tool.keybinding}\`` : '',
        `**Category:** ${tool.category || 'other'}`,
        tool.priority !== undefined ? `**Priority:** ${tool.priority}` : ''
    ].filter(Boolean).join('\n');

    const action = await vscode.window.showInformationMessage(
        message,
        { modal: false },
        'Execute',
        'Copy Command'
    );

    if (action === 'Execute') {
        await vscode.commands.executeCommand(tool.command);
    } else if (action === 'Copy Command') {
        await vscode.env.clipboard.writeText(tool.command);
    }
}

/**
 * Toggles compact mode
 */
async function toggleCompactMode(context: vscode.ExtensionContext): Promise<void> {
    isCompactMode = !isCompactMode;
    await context.globalState.update('atm.compactMode', isCompactMode);
    scheduleRender();
    
    // Show notification for mode change
    const message = isCompactMode ? 'Compact mode enabled' : 'Expanded mode enabled';
    vscode.window.showInformationMessage(`✓ ATM: ${message}`);
}

/**
 * Cycles through FAAH audio options
 */
async function cycleFaahAudio(context: vscode.ExtensionContext): Promise<void> {
    // Cycle to next audio option
    currentFaahAudioIndex = (currentFaahAudioIndex + 1) % CONSTANTS.FAAH_AUDIO_OPTIONS.length;
    
    // Save preference
    await context.globalState.update('atm.faah.audioIndex', currentFaahAudioIndex);
    
    // Get current audio option
    const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
    
    // Update FAAH configuration
    const faahConfig = vscode.workspace.getConfiguration('faah');
    const soundPath = context.extensionPath;
    if (soundPath) {
        const fullPath = `${soundPath}/src/extensions/faah/sound/${currentAudio.fileName}`;
        await faahConfig.update('customSoundPath', fullPath, vscode.ConfigurationTarget.Global);
    }
    
    // Update UI
    scheduleRender();
    
    // Show notification
    vscode.window.showInformationMessage(`🔊 Error Audio: ${currentAudio.name}`);
    
    console.log(`[ATM] FAAH audio changed to: ${currentAudio.name}`);
}

/**
 * Tests the current FAAH audio
 */
async function testFaahAudio(context: vscode.ExtensionContext): Promise<void> {
    try {
        await vscode.commands.executeCommand('faah.testSound');
        console.log('[ATM] FAAH audio test triggered');
    } catch (error) {
        console.error('[ATM] Failed to test FAAH audio:', error);
        vscode.window.showWarningMessage('Could not test audio. Make sure FAAH extension is active.');
    }
}

/**
 * Schedules a debounced render of the hover UI
 */
function scheduleRender(): void {
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
    }
    
    renderDebounceTimer = setTimeout(() => {
        renderHoverUI();
        renderDebounceTimer = undefined;
    }, CONSTANTS.DEBOUNCE_DELAY);
}

/**
 * Generates a hash of the current state for caching
 * @returns A hash string representing current state
 */
function generateStateHash(): string {
    const isPro = checkIsPro();
    const toolIds = Array.from(toolRegistry.keys()).sort().join(',');
    return `${isPro}:${toolIds}:${toolRegistry.size}:${isCompactMode}:${currentFaahAudioIndex}`;
}

/**
 * Renders the hover UI tooltip for the status bar with enhanced visuals
 */
function renderHoverUI(): void {
    if (!globalStatusBarItem) { 
        console.warn('[ATM] Cannot render: status bar not initialized');
        return; 
    }

    // Performance: Skip render if nothing changed
    const currentHash = generateStateHash();
    if (lastRenderedHash === currentHash) {
        return;
    }
    lastRenderedHash = currentHash;

    try {
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportThemeIcons = true;
        md.supportHtml = true;

        const isPro = checkIsPro();
        const stats = getToolStats();

        // Header - Different for compact mode
        if (isCompactMode) {
            md.appendMarkdown('### **ATM**\n\n');
        } else {
            md.appendMarkdown('### **ATM** <span style="color:#888888;">Control Center</span>\n\n');
            md.appendMarkdown(
                `<sub><span style="color:#888888;">Advanced Tool Management System</span></sub>\n\n`
            );
        }

        md.appendMarkdown('<hr>\n\n');

        // Quick Stats (if not compact)
        if (!isCompactMode && stats.totalTools > 0) {
            md.appendMarkdown('**Status:** ');
            md.appendMarkdown(
                `<span style="color:#4EC9B0;">${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active</span>\n\n`
            );
        }

        // Tools Section - Organized by category
        if (toolRegistry.size === 0) {
            md.appendMarkdown('$(info) &nbsp; _No active tools detected_\n\n');
        } else {
            const toolsByCategory = organizeToolsByCategory();
            let toolCount = 0;
            const maxToolsToShow = isCompactMode ? 5 : 10;

            for (const [category, tools] of toolsByCategory) {
                if (toolCount >= maxToolsToShow) {
                    const remaining = stats.totalTools - toolCount;
                    md.appendMarkdown(
                        `\n<sub><span style="color:#888888;">... and ${remaining} more tool${remaining !== 1 ? 's' : ''}</span></sub>\n\n`
                    );
                    break;
                }

                if (!isCompactMode) {
                    const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || 
                                         CONSTANTS.CATEGORIES.other;
                    md.appendMarkdown(`**${categoryInfo.icon} ${categoryInfo.label}**\n\n`);
                }

                // Sort and display tools
                const sortedTools = tools
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .slice(0, maxToolsToShow - toolCount);

                for (const state of sortedTools) {
                    const desc = !isCompactMode && state.description 
                        ? ` <span style="color:#888888;">— ${escapeMarkdown(state.description)}</span>` 
                        : '';
                    const keybinding = !isCompactMode && state.keybinding
                        ? ` <sub><span style="color:#569CD6;">[${state.keybinding}]</span></sub>`
                        : '';
                    
                    md.appendMarkdown(
                        `${state.icon} &nbsp; **[${escapeMarkdown(state.name)}](command:${state.command})**${keybinding}${desc}\n\n`
                    );
                    toolCount++;
                }

                if (!isCompactMode && toolCount < maxToolsToShow) {
                    md.appendMarkdown('\n');
                }
            }
        }

        md.appendMarkdown('<hr>\n\n');

        // Layout Section with visual indicators
        const normalIcon = !isPro ? '$(pass-filled)' : '$(circle-outline)';
        const proIcon = isPro ? '$(pass-filled)' : '$(circle-outline)';
        
        const normalItem = !isPro 
            ? `${normalIcon} **Normal**` 
            : `${normalIcon} [Normal](command:${CONSTANTS.COMMANDS.LAYOUT_NORMAL})`;
        const proItem = isPro 
            ? `${proIcon} **Pro**` 
            : `${proIcon} [Pro](command:${CONSTANTS.COMMANDS.LAYOUT_PRO})`;

        md.appendMarkdown(`**Layout:** &nbsp; ${normalItem} &nbsp; | &nbsp; ${proItem}\n\n`);

        if (!isCompactMode) {
            const currentLayout = isPro ? CONSTANTS.LAYOUTS.PRO : CONSTANTS.LAYOUTS.NORMAL;
            md.appendMarkdown(
                `<sub><span style="color:#888888;">${currentLayout.description}</span></sub>\n\n`
            );
        }

        // FAAH Audio Section
        const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
        md.appendMarkdown(`**ERROR Audio:** &nbsp; [${currentAudio.icon} ${currentAudio.name}](command:${CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO}) &nbsp; | &nbsp; [$(unmute)](command:${CONSTANTS.COMMANDS.FAAH_TEST_AUDIO})\n\n`);
        
        if (!isCompactMode) {
            // Removed the description text as requested
        }

        md.appendMarkdown('<hr>\n\n');

        // Quick Actions (only in expanded mode)
        if (!isCompactMode) {
            md.appendMarkdown('**Quick Actions:** &nbsp; ');
            md.appendMarkdown(
                `[$(refresh) Refresh](command:${CONSTANTS.COMMANDS.REFRESH_TOOLS}) &nbsp; | &nbsp; `
            );
            md.appendMarkdown(
                `[$(collapse-all) Compact](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT})\n\n`
            );
        }

        // Footer with status indicator
        const statusColor = stats.totalTools > 0 ? '#4EC9B0' : '#888888';
        const statusIcon = stats.totalTools > 0 ? '$(pulse)' : '$(circle-outline)';
        const statusText = stats.totalTools > 0 
            ? 'All systems operational' 
            : 'Awaiting tool activation';

        // In compact mode, add expand button next to status
        if (isCompactMode) {
            md.appendMarkdown(
                `<sub><span style="color:${statusColor};">${statusIcon}</span> ` +
                `<span style="color:#888888;">${statusText}</span></sub>` +
                `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` +
                `[$(unfold)](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Click to expand")`
            );
        } else {
            md.appendMarkdown(
                `<sub><span style="color:${statusColor};">${statusIcon}</span> ` +
                `<span style="color:#888888;">${statusText}</span></sub>`
            );
        }

        globalStatusBarItem.tooltip = md;
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;

        // Visual feedback for active tools
        if (toolRegistry.size > 0) {
            globalStatusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
            globalStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            globalStatusBarItem.color = undefined;
            globalStatusBarItem.backgroundColor = undefined;
        }

        // Update accessibility info
        globalStatusBarItem.accessibilityInformation = {
            label: `ATM Control Center - ${stats.totalTools} active tool${stats.totalTools !== 1 ? 's' : ''} - Click to open menu`,
            role: 'button'
        };
    } catch (error) {
        console.error('[ATM] Error rendering hover UI:', error);
        // Fallback to simple tooltip
        if (globalStatusBarItem) {
            globalStatusBarItem.tooltip = 'ATM Control Center (Error rendering details)';
        }
    }
}

/**
 * Escapes markdown special characters
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

/**
 * Gets the current FAAH audio configuration
 * @returns The current FAAH audio option
 */
export function getCurrentFaahAudio(): FaahAudioOption {
    return CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
}

/**
 * Sets the FAAH audio by ID (for programmatic control)
 * @param audioId - The ID of the audio to set
 * @param context - Extension context for saving state
 */
export async function setFaahAudio(audioId: string, context: vscode.ExtensionContext): Promise<boolean> {
    const audioIndex = CONSTANTS.FAAH_AUDIO_OPTIONS.findIndex(audio => audio.id === audioId);
    if (audioIndex === -1) {
        console.warn(`[ATM] Invalid FAAH audio ID: ${audioId}`);
        return false;
    }
    
    currentFaahAudioIndex = audioIndex;
    await context.globalState.update('atm.faah.audioIndex', currentFaahAudioIndex);
    
    // Update FAAH configuration
    const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
    const faahConfig = vscode.workspace.getConfiguration('faah');
    const fullPath = `${context.extensionPath}/src/extensions/faah/sound/${currentAudio.fileName}`;
    await faahConfig.update('customSoundPath', fullPath, vscode.ConfigurationTarget.Global);
    
    scheduleRender();
    console.log(`[ATM] FAAH audio set to: ${currentAudio.name}`);
    return true;
}

/**
 * Deactivates and cleans up the global status bar
 * Prevents memory leaks by clearing timers and disposing resources
 */
export function deactivateGlobalStatusBar(): void {
    // Clear any pending render timer
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
        renderDebounceTimer = undefined;
    }
    
    // Clear the tool registry
    toolRegistry.clear();
    
    // Reset state
    lastRenderedHash = undefined;
    isCompactMode = false;
    currentFaahAudioIndex = 0;
    
    // Dispose the status bar item
    if (globalStatusBarItem) {
        globalStatusBarItem.dispose();
        globalStatusBarItem = undefined;
    }
    
    console.log('[ATM] Status bar deactivated and cleaned up');
}

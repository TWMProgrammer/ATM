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
        { id: 'faah', name: 'Faah', fileName: 'faah.wav', icon: '$(unmute)' },
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
    const previousState = toolRegistry.get(state.id);
    toolRegistry.set(state.id, state);
    scheduleRender();
    
    if (isNewTool) {
        console.log(`[ATM] Tool registered: ${state.name} (${state.id})`);
        // Notification removed for cleaner UX
    } else {
        console.log(`[ATM] Tool updated: ${state.name} (${state.id})`);
        
        // Log what changed
        if (previousState) {
            const changes: string[] = [];
            if (previousState.name !== state.name) {changes.push('name');}
            if (previousState.icon !== state.icon) {changes.push('icon');}
            if (previousState.description !== state.description) {changes.push('description');}
            if (previousState.priority !== state.priority) {changes.push('priority');}
            
            if (changes.length > 0) {
                console.log(`[ATM] Tool changes: ${changes.join(', ')}`);
            }
        }
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

    // Header with stats
    items.push({ 
        label: `$(verified-filled) ATM Control Center`, 
        kind: vscode.QuickPickItemKind.Separator 
    });

    // Quick Actions Section with better icons
    items.push({ label: '$(zap) Quick Actions', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: `$(refresh) Refresh Tools`,
        description: `${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active`,
        detail: 'Reload all tool states and update display',
        alwaysShow: true
    });
    items.push({
        label: isCompactMode ? '$(expand-all) Expand Mode' : '$(collapse-all) Compact Mode',
        description: isCompactMode ? 'Show detailed view' : 'Minimize display',
        detail: isCompactMode ? 'Switch to expanded tooltips with full information' : 'Switch to compact mode for minimal display',
        alwaysShow: true
    });

    // FAAH Audio Section with all options visible
    items.push({ label: '$(unmute) Error Audio Themes', kind: vscode.QuickPickItemKind.Separator });
    
    for (let i = 0; i < CONSTANTS.FAAH_AUDIO_OPTIONS.length; i++) {
        const audio = CONSTANTS.FAAH_AUDIO_OPTIONS[i];
        const isActive = i === currentFaahAudioIndex;
        items.push({
            label: isActive ? `$(pass-filled) ${audio.icon} ${audio.name}` : `$(circle-outline) ${audio.icon} ${audio.name}`,
            description: isActive ? 'Currently active' : 'Click to activate',
            detail: `Error audio theme: ${audio.name}`,
            alwaysShow: true
        });
    }
    
    // Add test audio option
    items.push({
        label: `$(play) Test Current Audio`,
        description: `Preview ${CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex].name}`,
        detail: 'Play the currently selected error audio',
        alwaysShow: true
    });

    // Layout Section with better visual hierarchy
    items.push({ label: '$(layout) Workspace Layouts', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: !isPro ? '$(pass-filled) Normal Layout' : '$(circle-outline) Normal Layout',
        description: CONSTANTS.LAYOUTS.NORMAL.description,
        detail: !isPro ? '✓ Currently active' : 'Click to activate this layout',
        alwaysShow: true
    });
    items.push({
        label: isPro ? '$(pass-filled) Pro Layout' : '$(circle-outline) Pro Layout',
        description: CONSTANTS.LAYOUTS.PRO.description,
        detail: isPro ? '✓ Currently active' : 'Click to activate this layout',
        alwaysShow: true
    });

    // Tools Section - Organized by category with improved presentation
    if (toolRegistry.size > 0) {
        const toolsByCategory = organizeToolsByCategory();
        
        for (const [category, tools] of toolsByCategory) {
            const categoryInfo = CONSTANTS.CATEGORIES[category as keyof typeof CONSTANTS.CATEGORIES] || 
                                 CONSTANTS.CATEGORIES.other;
            
            items.push({ 
                label: `${categoryInfo.icon} ${categoryInfo.label} (${tools.length})`, 
                kind: vscode.QuickPickItemKind.Separator 
            });

            // Sort tools by priority (higher first) then by name
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
        // Handle layout selections
        if (selected.label.includes('Normal Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL);
        } else if (selected.label.includes('Pro Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_PRO);
        } 
        // Handle quick actions
        else if (selected.label.includes('Refresh Tools')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS);
            vscode.window.showInformationMessage('✓ ATM: Tools refreshed successfully');
        } else if (selected.label.includes('Compact Mode') || selected.label.includes('Expand Mode')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT);
        } 
        // Handle audio theme selections
        else if (selected.label.includes('Test Current Audio')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_TEST_AUDIO);
        } else if (selected.detail?.includes('Error audio theme:')) {
            // Find which audio was selected
            const audioName = selected.label.replace(/\$\([^)]+\)\s*/g, '').trim();
            const audioOption = CONSTANTS.FAAH_AUDIO_OPTIONS.find(a => a.name === audioName);
            if (audioOption) {
                const audioIndex = CONSTANTS.FAAH_AUDIO_OPTIONS.indexOf(audioOption);
                if (audioIndex !== currentFaahAudioIndex) {
                    currentFaahAudioIndex = audioIndex;
                    await vscode.commands.executeCommand(CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO);
                }
            }
        }
        // Handle tool executions
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
 * Applies a layout configuration to the workbench with visual feedback
 * @param layout - The layout configuration to apply
 */
async function applyLayout(layout: LayoutConfig): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('workbench');
        const currentIsPro = checkIsPro();
        const targetIsPro = layout.sideBarLocation === 'right' && layout.activityBarLocation === 'top';
        
        // Don't apply if already in this layout
        if (currentIsPro === targetIsPro) {
            vscode.window.showInformationMessage(
                `$(info) ${layout.displayName} is already active`
            );
            return;
        }
        
        // Show progress notification with steps
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `$(layout) Applying ${layout.displayName}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Configuring sidebar...' });
            await config.update('sideBar.location', layout.sideBarLocation, vscode.ConfigurationTarget.Global);
            
            progress.report({ increment: 50, message: 'Configuring activity bar...' });
            await config.update('activityBar.location', layout.activityBarLocation, vscode.ConfigurationTarget.Global);
            
            progress.report({ increment: 100, message: 'Complete!' });
            await new Promise(resolve => setTimeout(resolve, 300));
        });

        scheduleRender();
        
        vscode.window.showInformationMessage(
            `✓ ${layout.displayName} activated — ${layout.description}`
        );
        
        console.log(`[ATM] Layout applied: ${layout.displayName}`);
    } catch (error) {
        console.error('[ATM] Failed to apply layout:', error);
        vscode.window.showErrorMessage(
            `$(error) Failed to apply ${layout.displayName}`
        );
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
        // Show extended info in output channel
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

/**
 * Toggles compact mode
 */
async function toggleCompactMode(context: vscode.ExtensionContext): Promise<void> {
    const previousMode = isCompactMode;
    isCompactMode = !isCompactMode;
    await context.globalState.update('atm.compactMode', isCompactMode);
    scheduleRender();
    
    // Show notification with visual feedback
    const icon = isCompactMode ? '$(collapse-all)' : '$(expand-all)';
    const mode = isCompactMode ? 'Compact' : 'Expanded';
    const description = isCompactMode 
        ? 'Minimal display activated' 
        : 'Detailed view activated';
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${icon} Switching to ${mode} mode...`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0 });
        await new Promise(resolve => setTimeout(resolve, 200));
        progress.report({ increment: 100 });
    });
    
    vscode.window.showInformationMessage(
        `✓ ATM: ${mode} mode — ${description}`
    );
    
    console.log(`[ATM] Display mode changed: ${previousMode ? 'Compact' : 'Expanded'} → ${mode}`);
}

/**
 * Cycles through FAAH audio options
 */
async function cycleFaahAudio(context: vscode.ExtensionContext): Promise<void> {
    // Get current audio option before cycling
    const previousAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
    
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
    
    // Show notification with progress animation
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${currentAudio.icon} Switching to ${currentAudio.name}...`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0 });
        await new Promise(resolve => setTimeout(resolve, 300));
        progress.report({ increment: 100 });
    });
    
    vscode.window.showInformationMessage(
        `✓ Error Audio: ${previousAudio.name} → ${currentAudio.name}`
    );
    
    console.log(`[ATM] FAAH audio changed: ${previousAudio.name} → ${currentAudio.name}`);
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

        // Header with gradient-like effect
        if (isCompactMode) {
            md.appendMarkdown('### **ATM**\n\n');
        } else {
            md.appendMarkdown('### **ATM** <span style="color:#888888;">Control Center</span>\n\n');
            md.appendMarkdown(
                `<sub><span style="color:#9370DB;">Advanced Tool Management System</span></sub>\n\n`
            );
        }

        md.appendMarkdown('---\n\n');

        // Quick Stats with better visual hierarchy
        if (!isCompactMode && stats.totalTools > 0) {
            md.appendMarkdown('**Status:** ');
            md.appendMarkdown(
                `<span style="color:#4EC9B0;">$(check) ${stats.totalTools} tool${stats.totalTools !== 1 ? 's' : ''} active</span>\n\n`
            );
        }

        // Tools Section - Organized by category with improved spacing
        if (toolRegistry.size === 0) {
            md.appendMarkdown('$(info) &nbsp; _No active tools detected_\n\n');
            md.appendMarkdown('<sub>Tools will appear here when activated</sub>\n\n');
        } else {
            const toolsByCategory = organizeToolsByCategory();
            let toolCount = 0;
            const maxToolsToShow = isCompactMode ? 5 : 10;

            for (const [category, tools] of toolsByCategory) {
                if (toolCount >= maxToolsToShow) {
                    const remaining = stats.totalTools - toolCount;
                    md.appendMarkdown(
                        `\n<sub><span style="color:#888888;">$(ellipsis) ${remaining} more tool${remaining !== 1 ? 's' : ''} available</span></sub>\n\n`
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
                        ? ` <span style="color:#808080;">— ${escapeMarkdown(state.description)}</span>` 
                        : '';
                    const keybinding = !isCompactMode && state.keybinding
                        ? ` <sub><span style="color:#569CD6;">[${state.keybinding}]</span></sub>`
                        : '';
                    
                    md.appendMarkdown(
                        `${state.icon} &nbsp; **[${escapeMarkdown(state.name)}](command:${state.command} "${escapeMarkdown(state.description || 'Execute ' + state.name)}")**${keybinding}${desc}\n\n`
                    );
                    toolCount++;
                }

                if (!isCompactMode && toolCount < maxToolsToShow) {
                    md.appendMarkdown('\n');
                }
            }
        }

        md.appendMarkdown('---\n\n');

        // Layout Section with improved visual indicators
        const normalIcon = !isPro ? '$(pass-filled)' : '$(circle-outline)';
        const proIcon = isPro ? '$(pass-filled)' : '$(circle-outline)';
        
        const normalItem = !isPro 
            ? `${normalIcon} <span style="color:#4EC9B0;">**Normal**</span>` 
            : `${normalIcon} [Normal](command:${CONSTANTS.COMMANDS.LAYOUT_NORMAL} "Switch to Normal Layout")`;
        const proItem = isPro 
            ? `${proIcon} <span style="color:#4EC9B0;">**Pro**</span>` 
            : `${proIcon} [Pro](command:${CONSTANTS.COMMANDS.LAYOUT_PRO} "Switch to Pro Layout")`;

        md.appendMarkdown(`**Layout:** &nbsp; ${normalItem} &nbsp; $(chevron-right) &nbsp; ${proItem}\n\n`);

        // FAAH Audio Section with better visual feedback
        const currentAudio = CONSTANTS.FAAH_AUDIO_OPTIONS[currentFaahAudioIndex];
        md.appendMarkdown(
            `**Error Audio:** &nbsp; [${currentAudio.icon} <span style="color:#CE9178;">${currentAudio.name}</span>](command:${CONSTANTS.COMMANDS.FAAH_CYCLE_AUDIO} "Cycle audio theme") &nbsp; $(chevron-right) &nbsp; [$(play) Test](command:${CONSTANTS.COMMANDS.FAAH_TEST_AUDIO} "Test current audio")\n\n`
        );

        md.appendMarkdown('---\n\n');

        // Quick Actions (only in expanded mode) - centered without header
        if (!isCompactMode) {
            md.appendMarkdown(
                `[$(refresh) Refresh](command:${CONSTANTS.COMMANDS.REFRESH_TOOLS} "Reload all tools") &nbsp; l &nbsp; `
            );
            md.appendMarkdown(
                `[$(collapse-all) Compact](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Switch to compact mode")\n\n`
            );
            md.appendMarkdown('---\n\n');
        }

        // Footer with enhanced status indicator
        const statusColor = stats.totalTools > 0 ? '#4EC9B0' : '#888888';
        const statusIcon = stats.totalTools > 0 ? '$(pulse)' : '$(circle-outline)';
        const statusText = stats.totalTools > 0 
            ? 'All systems operational' 
            : 'Awaiting tool activation';

        // In compact mode, add expand button on the same line, aligned right
        if (isCompactMode) {
            // Use non-breaking spaces to push the icon to the right
            const spacing = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            md.appendMarkdown(
                `<sub><span style="color:${statusColor};">${statusIcon} ${statusText}</span></sub>${spacing}[$(unfold)](command:${CONSTANTS.COMMANDS.TOGGLE_COMPACT} "Show detailed view")`
            );
        } else {
            md.appendMarkdown(
                `<sub><span style="color:${statusColor};">${statusIcon} ${statusText}</span></sub>`
            );
        }

        globalStatusBarItem.tooltip = md;
        
        // Status bar text - always simple without count
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;

        // Visual feedback for active tools with subtle animation effect
        if (toolRegistry.size > 0) {
            globalStatusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
            globalStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            globalStatusBarItem.color = undefined;
            globalStatusBarItem.backgroundColor = undefined;
        }

        // Enhanced accessibility info
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

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { renderMinimalTooltip, showMinimalQuickMenu } from './minimal';
import { renderAdvancedTooltip, showAdvancedQuickMenu } from './advanced';

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
    readonly priority?: number;
    readonly keybinding?: string;
}

/**
 * Layout configuration for the workbench
 */
export interface LayoutConfig {
    readonly sideBarLocation: 'left' | 'right';
    readonly activityBarLocation: 'default' | 'top';
    readonly displayName: string;
    readonly description: string;
}

/**
 * Statistics about tool usage
 */
export interface ToolStats {
    totalTools: number;
    activeTools: number;
    categoryCounts: Map<string, number>;
}

/**
 * Terminal Sound Audio configuration
 */
export interface TerminalSoundAudioOption {
    readonly id: string;
    readonly name: string;
    readonly fileName: string;
    readonly icon: string;
}

/**
 * Shared context for rendering
 */
export interface RenderContext {
    toolRegistry: Map<string, ToolState>;
    isPro: boolean;
    currentTerminalSoundAudioIndex: number;
    isTerminalSoundEnabled: boolean;
    extensionContext: vscode.ExtensionContext;
}

// Constants
export const CONSTANTS = {
    STATUS_BAR_PRIORITY: 95,
    STATUS_BAR_TEXT: '$(verified-filled) ATM',
    DEBOUNCE_DELAY: 150,
    COMMANDS: {
        STATUS_CLICKED: 'atm.global.statusClicked',
        LAYOUT_NORMAL: 'atm.layout.normal',
        LAYOUT_PRO: 'atm.layout.pro',
        TOGGLE_COMPACT: 'atm.toggleCompactMode',
        REFRESH_TOOLS: 'atm.refreshTools',
        TERMINAL_SOUND_CYCLE_AUDIO: 'atm.terminalSound.cycleAudio',
        TERMINAL_SOUND_TEST_AUDIO: 'atm.terminalSound.testAudio',
        TERMINAL_SOUND_TOGGLE_MUTE: 'atm.terminalSound.toggleMute'
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
    TERMINAL_SOUND_AUDIO_OPTIONS: [
        { id: 'faah', name: 'Faah', fileName: 'faah.wav', icon: '$(megaphone)' },
        { id: 'ack', name: 'ACK', fileName: 'ack.wav', icon: '$(pulse)' },
        { id: 'fatality', name: 'Fatality', fileName: 'fatality.wav', icon: '$(flame)' },
        { id: 'windows', name: 'Windows', fileName: 'windows.wav', icon: '$(window)' }
    ] as TerminalSoundAudioOption[],
    CATEGORIES: {
        productivity: { icon: '$(rocket)', label: 'Productivity' },
        debugging: { icon: '$(bug)', label: 'Debugging' },
        ui: { icon: '$(paintcan)', label: 'UI/UX' },
        analysis: { icon: '$(graph)', label: 'Analysis' },
        other: { icon: '$(tools)', label: 'Other' }
    }
} as const;

// Global state
let globalStatusBarItem: vscode.StatusBarItem | undefined;
let renderDebounceTimer: NodeJS.Timeout | undefined;
let isCompactMode = false;
let lastRenderedHash: string | undefined;
let currentTerminalSoundAudioIndex = 0;
let extensionContext: vscode.ExtensionContext;

export const toolRegistry = new Map<string, ToolState>();

/**
 * Activates the global ATM status bar with all commands and event listeners
 */
export function activateGlobalStatusBar(context: vscode.ExtensionContext): void {
    if (globalStatusBarItem) { 
        console.warn('[ATM] Status bar already activated');
        return; 
    }

    try {
        extensionContext = context;
        
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

        // Load preferences
        isCompactMode = context.globalState.get('atm.compactMode', false);
        currentTerminalSoundAudioIndex = context.globalState.get('atm.terminalSound.audioIndex', 0);

        // Register commands
        registerCommands(context);

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

        console.log('[ATM] Status bar activated successfully');
    } catch (error) {
        console.error('[ATM] Failed to activate status bar:', error);
    }
}

/**
 * Registers all commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.STATUS_CLICKED, handleStatusBarClick),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL, () => applyLayout(CONSTANTS.LAYOUTS.NORMAL)),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_PRO, () => applyLayout(CONSTANTS.LAYOUTS.PRO)),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TOGGLE_COMPACT, toggleCompactMode),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.REFRESH_TOOLS, handleRefreshTools),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TERMINAL_SOUND_CYCLE_AUDIO, cycleTerminalSoundAudio),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TERMINAL_SOUND_TEST_AUDIO, testTerminalSoundAudio),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE, toggleTerminalSoundMute)
    );
}

/**
 * Registers or updates a tool in the status bar registry
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
    } else {
        console.log(`[ATM] Tool updated: ${state.name} (${state.id})`);
        
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
 */
export function removeToolState(id: string): void {
    if (!id || typeof id !== 'string') {
        console.warn('[ATM] Invalid tool ID for removal:', id);
        return;
    }

    const removed = toolRegistry.delete(id);
    if (removed) {
        scheduleRender();
        console.log(`[ATM] Tool removed: ${id}`);
    }
}

/**
 * Handles status bar click event
 */
async function handleStatusBarClick(): Promise<void> {
    try {
        const context = getRenderContext();
        
        if (isCompactMode) {
            await showMinimalQuickMenu(context);
        } else {
            await showAdvancedQuickMenu(context);
        }
    } catch (error) {
        console.error('[ATM] Error showing quick menu:', error);
    }
}

/**
 * Handles refresh tools command
 */
function handleRefreshTools(): void {
    scheduleRender();
    vscode.window.showInformationMessage('✓ ATM: Tools refreshed successfully');
}

/**
 * Applies a layout configuration to the workbench
 */
export async function applyLayout(layout: LayoutConfig): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('workbench');
        const currentIsPro = checkIsPro();
        const targetIsPro = layout.sideBarLocation === 'right' && layout.activityBarLocation === 'top';
        
        if (currentIsPro === targetIsPro) {
            vscode.window.showInformationMessage(`${layout.displayName} is already active`);
            return;
        }
        
        // Apply layout changes
        await config.update('sideBar.location', layout.sideBarLocation, vscode.ConfigurationTarget.Global);
        await config.update('activityBar.location', layout.activityBarLocation, vscode.ConfigurationTarget.Global);

        scheduleRender();
        vscode.window.showInformationMessage(`${layout.displayName} activated`);
        console.log(`[ATM] Layout applied: ${layout.displayName}`);
    } catch (error) {
        console.error('[ATM] Failed to apply layout:', error);
        vscode.window.showErrorMessage(`Failed to apply ${layout.displayName}`);
    }
}

/**
 * Toggles compact mode
 */
async function toggleCompactMode(): Promise<void> {
    const previousMode = isCompactMode;
    isCompactMode = !isCompactMode;
    await extensionContext.globalState.update('atm.compactMode', isCompactMode);
    scheduleRender();
    
    const mode = isCompactMode ? 'Compact' : 'Expanded';
    
    vscode.window.showInformationMessage(`ATM: ${mode} mode activated`);
    console.log(`[ATM] Display mode changed: ${previousMode ? 'Compact' : 'Expanded'} → ${mode}`);
}

/**
 * Cycles through Terminal Sound audio options
 */
export async function cycleTerminalSoundAudio(): Promise<void> {
    const previousAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[currentTerminalSoundAudioIndex];
    currentTerminalSoundAudioIndex = (currentTerminalSoundAudioIndex + 1) % CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS.length;
    
    await extensionContext.globalState.update('atm.terminalSound.audioIndex', currentTerminalSoundAudioIndex);
    
    const currentAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[currentTerminalSoundAudioIndex];
    const terminalSoundConfig = vscode.workspace.getConfiguration('terminalSound');
    const fullPath = resolveBundledTerminalSoundAudioPath(currentAudio.fileName, extensionContext);
    await terminalSoundConfig.update('customSoundPath', fullPath, vscode.ConfigurationTarget.Global);
    
    scheduleRender();
    
    // Show a simple notification without icons
    vscode.window.showInformationMessage(
        `Audio: ${previousAudio.name} → ${currentAudio.name}`
    );
    
    console.log(`[ATM] Terminal Sound audio changed: ${previousAudio.name} → ${currentAudio.name}`);
}

/**
 * Tests the current Terminal Sound audio
 */
async function testTerminalSoundAudio(): Promise<void> {
    try {
        await vscode.commands.executeCommand('terminalSound.testSound');
        console.log('[ATM] Terminal Sound audio test triggered');
    } catch (error) {
        console.error('[ATM] Failed to test Terminal Sound audio:', error);
        vscode.window.showWarningMessage('Could not test audio. Make sure Terminal Sound extension is active.');
    }
}

/**
 * Toggles Terminal Sound mute state directly
 */
async function toggleTerminalSoundMute(): Promise<void> {
    const config = vscode.workspace.getConfiguration('terminalSound');
    const isCurrentlyEnabled = config.get<boolean>('enabled', true);
    await config.update('enabled', !isCurrentlyEnabled, vscode.ConfigurationTarget.Global);
    scheduleRender();
    vscode.window.showInformationMessage(`Terminal Audio ${isCurrentlyEnabled ? 'Muted' : 'Unmuted'}`);
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
 * Renders the hover UI tooltip - delegates to minimal or advanced mode
 */
function renderHoverUI(): void {
    if (!globalStatusBarItem) { 
        console.warn('[ATM] Cannot render: status bar not initialized');
        return; 
    }

    const currentHash = generateStateHash();
    if (lastRenderedHash === currentHash) {
        return;
    }
    lastRenderedHash = currentHash;

    try {
        const context = getRenderContext();
        
        if (isCompactMode) {
            renderMinimalTooltip(globalStatusBarItem, context);
        } else {
            renderAdvancedTooltip(globalStatusBarItem, context);
        }

        // Update status bar text and colors
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;
        
        if (toolRegistry.size > 0) {
            globalStatusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
            globalStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            globalStatusBarItem.color = undefined;
            globalStatusBarItem.backgroundColor = undefined;
        }

        const stats = getToolStats();
        globalStatusBarItem.accessibilityInformation = {
            label: `ATM Control Center - ${stats.totalTools} active tool${stats.totalTools !== 1 ? 's' : ''} - Click to open menu`,
            role: 'button'
        };
    } catch (error) {
        console.error('[ATM] Error rendering hover UI:', error);
        if (globalStatusBarItem) {
            globalStatusBarItem.tooltip = 'ATM Control Center (Error rendering details)';
        }
    }
}

/**
 * Gets the current Terminal Sound audio configuration
 */
export function getCurrentTerminalSoundAudio(): TerminalSoundAudioOption {
    return CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[currentTerminalSoundAudioIndex];
}

/**
 * Sets the Terminal Sound audio by ID
 */
export async function setTerminalSoundAudio(audioId: string, context: vscode.ExtensionContext): Promise<boolean> {
    const audioIndex = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS.findIndex(audio => audio.id === audioId);
    if (audioIndex === -1) {
        console.warn(`[ATM] Invalid Terminal Sound audio ID: ${audioId}`);
        return false;
    }
    
    currentTerminalSoundAudioIndex = audioIndex;
    await context.globalState.update('atm.terminalSound.audioIndex', currentTerminalSoundAudioIndex);
    
    const currentAudio = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS[currentTerminalSoundAudioIndex];
    const terminalSoundConfig = vscode.workspace.getConfiguration('terminalSound');
    const fullPath = resolveBundledTerminalSoundAudioPath(currentAudio.fileName, context);
    await terminalSoundConfig.update('customSoundPath', fullPath, vscode.ConfigurationTarget.Global);
    
    scheduleRender();
    console.log(`[ATM] Terminal Sound audio set to: ${currentAudio.name}`);
    return true;
}

/**
 * Resolves Terminal Sound bundled audio from known extension locations
 */
function resolveBundledTerminalSoundAudioPath(fileName: string, context: vscode.ExtensionContext): string {
    const candidates = [
        path.join(context.extensionPath, 'src', 'extensions', 'terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'dist', 'extensions', 'terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'dist', 'terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'sound', fileName)
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}

/**
 * Deactivates and cleans up the global status bar
 */
export function deactivateGlobalStatusBar(): void {
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
        renderDebounceTimer = undefined;
    }
    
    toolRegistry.clear();
    lastRenderedHash = undefined;
    isCompactMode = false;
    currentTerminalSoundAudioIndex = 0;
    
    if (globalStatusBarItem) {
        globalStatusBarItem.dispose();
        globalStatusBarItem = undefined;
    }
    
    console.log('[ATM] Status bar deactivated and cleaned up');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates a ToolState object
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
 * Checks if the current layout is "Pro" mode
 */
export function checkIsPro(): boolean {
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
 * Gets statistics about registered tools
 */
export function getToolStats(): ToolStats {
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
export function organizeToolsByCategory(): Map<string, ToolState[]> {
    const organized = new Map<string, ToolState[]>();
    
    for (const tool of toolRegistry.values()) {
        const category = tool.category || 'other';
        if (!organized.has(category)) {
            organized.set(category, []);
        }
        organized.get(category)!.push(tool);
    }

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
 * Generates a hash of the current state for caching
 */
function generateStateHash(): string {
    const isPro = checkIsPro();
    const terminalSoundConfig = vscode.workspace.getConfiguration('terminalSound');
    const isTerminalSoundEnabled = terminalSoundConfig.get<boolean>('enabled', true);
    const toolIds = Array.from(toolRegistry.keys()).sort().join(',');
    return `${isPro}:${toolIds}:${toolRegistry.size}:${isCompactMode}:${currentTerminalSoundAudioIndex}:${isTerminalSoundEnabled}`;
}

/**
 * Escapes markdown special characters
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

/**
 * Gets the render context for minimal/advanced modes
 */
function getRenderContext(): RenderContext {
    const terminalSoundConfig = vscode.workspace.getConfiguration('terminalSound');
    const isTerminalSoundEnabled = terminalSoundConfig.get<boolean>('enabled', true);
    return {
        toolRegistry,
        isPro: checkIsPro(),
        currentTerminalSoundAudioIndex,
        isTerminalSoundEnabled,
        extensionContext
    };
}

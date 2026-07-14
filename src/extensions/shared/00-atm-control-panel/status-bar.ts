import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { renderMinimalTooltip, showMinimalQuickMenu } from './minimal';
import { renderAdvancedTooltip, showAdvancedQuickMenu } from './advanced';
import { CONSTANTS, type LayoutConfig, type RenderContext, type TerminalSoundAudioOption } from './utils';
import { toolRegistry, getToolStats, organizeToolsByCategory } from './tool-registry';

// Global state
let globalStatusBarItem: vscode.StatusBarItem | undefined;
let renderDebounceTimer: NodeJS.Timeout | undefined;
let isCompactMode = false;
let lastRenderedHash: string | undefined;
let currentTerminalSoundAudioIndex = 0;
let extensionContext: vscode.ExtensionContext;

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
        const savedAudioIndex = context.globalState.get<number>('atm.terminalSound.audioIndex', 0);
        currentTerminalSoundAudioIndex = normalizeTerminalSoundAudioIndex(savedAudioIndex);
        if (savedAudioIndex !== currentTerminalSoundAudioIndex) {
            void context.globalState.update('atm.terminalSound.audioIndex', currentTerminalSoundAudioIndex);
        }

        // Register commands
        registerCommands(context);

        // Register configuration change listener
        context.subscriptions.push(
            globalStatusBarItem,
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('workbench.sideBar.location') ||
                    e.affectsConfiguration('workbench.activityBar.location') ||
                    e.affectsConfiguration('tailwind-css.enabled') ||
                    e.affectsConfiguration('tailwind-css.autoFold') ||
                    e.affectsConfiguration('terminalSound.enabled') ||
                    e.affectsConfiguration('atm.bracketLynx.globalEnabled')) {
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
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TERMINAL_SOUND_TEST_AUDIO, testTerminalSoundAudio),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.TERMINAL_SOUND_TOGGLE_MUTE, toggleTerminalSoundMute),
        vscode.commands.registerCommand(CONSTANTS.COMMANDS.BRACKET_LYNX_CONTROL_PANEL_TOGGLE, toggleBracketLynx)
    );
}

/**
 * Toggles Bracket Lynx state
 */
async function toggleBracketLynx(): Promise<void> {
    try {
        await vscode.commands.executeCommand('atm.bracketLynx.toggle');
    } catch (error) {
        console.error('[ATM] Failed to toggle Bracket Lynx:', error);
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to toggle Bracket Lynx'));
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
    lastRenderedHash = undefined;
    scheduleRender();
    vscode.window.setStatusBarMessage('$(check) ATM: Tools refreshed', 1800);
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
            vscode.window.setStatusBarMessage(`$(check) ATM: ${layout.displayName} is active`, 1800);
            return;
        }

        await config.update('sideBar.location', layout.sideBarLocation, vscode.ConfigurationTarget.Global);
        await config.update('activityBar.location', layout.activityBarLocation, vscode.ConfigurationTarget.Global);

        scheduleRender();
        vscode.window.setStatusBarMessage(`$(check) ATM: ${layout.displayName} activated`, 1800);
        console.log(`[ATM] Layout applied: ${layout.displayName}`);
    } catch (error) {
        console.error('[ATM] Failed to apply layout:', error);
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to apply {0}', layout.displayName));
    }
}

/**
 * Toggles compact mode
 */
async function toggleCompactMode(): Promise<void> {
    isCompactMode = !isCompactMode;
    await extensionContext.globalState.update('atm.compactMode', isCompactMode);
    scheduleRender();

    const mode = isCompactMode ? 'Compact' : 'Expanded';
    vscode.window.setStatusBarMessage(`$(check) ATM: ${mode} view`, 1800);
    console.log(`[ATM] Display mode changed to ${mode}`);
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
        vscode.window.showWarningMessage(vscode.l10n.t('Could not test audio. Make sure Terminal Sound extension is active.'));
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
    vscode.window.setStatusBarMessage(`$(check) ATM: Terminal audio ${isCurrentlyEnabled ? 'muted' : 'enabled'}`, 1800);
}

/**
 * Schedules a debounced render of the hover UI
 */
export function scheduleRender(): void {
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

    try {
        const context = getRenderContext();
        const currentHash = generateStateHash(context);
        if (lastRenderedHash === currentHash) {
            return;
        }

        if (isCompactMode) {
            renderMinimalTooltip(globalStatusBarItem, context);
        } else {
            renderAdvancedTooltip(globalStatusBarItem, context);
        }

        // Update status bar text and colors
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;

        // Ensure standard theme inheritance (prevents dark grey contrast in debug mode)
        globalStatusBarItem.color = undefined;
        globalStatusBarItem.backgroundColor = undefined;
        lastRenderedHash = currentHash;

        const stats = getToolStats();
        globalStatusBarItem.accessibilityInformation = {
            label: `ATM Control Center - ${stats.totalTools} registered tool${stats.totalTools !== 1 ? 's' : ''} - Click to open menu`,
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
    const options = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS;
    if (options.length === 0) {
        return { id: 'faah', name: 'Faah', fileName: 'faah.wav', icon: '$(megaphone)' };
    }

    currentTerminalSoundAudioIndex = normalizeTerminalSoundAudioIndex(currentTerminalSoundAudioIndex);
    return options[currentTerminalSoundAudioIndex];
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
        path.join(context.extensionPath, 'src', 'extensions', '17-terminal-sound', 'sound', 'error', fileName),
        path.join(context.extensionPath, 'src', 'extensions', '17-terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'dist', 'extensions', '17-terminal-sound', 'sound', 'error', fileName),
        path.join(context.extensionPath, 'dist', 'extensions', '17-terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'dist', 'terminal-sound', 'sound', 'error', fileName),
        path.join(context.extensionPath, 'dist', 'terminal-sound', 'sound', fileName),
        path.join(context.extensionPath, 'sound', 'error', fileName),
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

function normalizeTerminalSoundAudioIndex(index: number): number {
    const totalAudioOptions = CONSTANTS.TERMINAL_SOUND_AUDIO_OPTIONS.length;
    if (totalAudioOptions === 0 || !Number.isFinite(index)) {
        return 0;
    }

    const normalized = Math.trunc(index) % totalAudioOptions;
    return normalized < 0 ? normalized + totalAudioOptions : normalized;
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
 * Generates a hash of the current state for caching
 */
function generateStateHash(context: RenderContext): string {
    const tools = [...context.toolRegistry.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(tool => [
            tool.id,
            tool.name,
            tool.icon,
            tool.command,
            tool.description,
            tool.category,
            tool.priority,
            tool.keybinding
        ]);
    return JSON.stringify([
        context.isPro,
        tools,
        isCompactMode,
        context.currentTerminalSoundAudioIndex,
        context.isTerminalSoundEnabled,
        context.isTailwindFoldEnabled,
        context.isTailwindAutoFold,
        context.isBracketLynxEnabled
    ]);
}

/**
 * Gets the render context for minimal/advanced modes
 */
function getRenderContext(): RenderContext {
    const terminalSoundConfig = vscode.workspace.getConfiguration('terminalSound');
    const isTerminalSoundEnabled = terminalSoundConfig.get<boolean>('enabled', true);
    const tailwindConfig = vscode.workspace.getConfiguration('tailwind-css');
    const isTailwindFoldEnabled = tailwindConfig.get<boolean>('enabled', true);
    const isTailwindAutoFold = tailwindConfig.get<boolean>('autoFold', true);
    const bracketLynxConfig = vscode.workspace.getConfiguration('atm.bracketLynx');
    const isBracketLynxEnabled = bracketLynxConfig.get<boolean>('globalEnabled', true);
    return {
        toolRegistry,
        isPro: checkIsPro(),
        currentTerminalSoundAudioIndex,
        isTerminalSoundEnabled,
        isTailwindFoldEnabled,
        isTailwindAutoFold,
        isBracketLynxEnabled,
        extensionContext
    };
}

import * as vscode from 'vscode';

let globalStatusBarItem: vscode.StatusBarItem | undefined;
let renderDebounceTimer: NodeJS.Timeout | undefined;

/**
 * Represents the state of a tool registered in the ATM status bar
 */
export interface ToolState {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly command: string;
    readonly description?: string;
}

/**
 * Layout configuration for the workbench
 */
interface LayoutConfig {
    readonly sideBarLocation: 'left' | 'right';
    readonly activityBarLocation: 'default' | 'top';
}

// Constants
const CONSTANTS = {
    STATUS_BAR_PRIORITY: 95,
    STATUS_BAR_TEXT: '$(verified-filled) ATM',
    DEBOUNCE_DELAY: 150, // ms
    COMMANDS: {
        STATUS_CLICKED: 'atm.global.statusClicked',
        LAYOUT_NORMAL: 'atm.layout.normal',
        LAYOUT_PRO: 'atm.layout.pro'
    },
    LAYOUTS: {
        NORMAL: { sideBarLocation: 'left', activityBarLocation: 'default' } as LayoutConfig,
        PRO: { sideBarLocation: 'right', activityBarLocation: 'top' } as LayoutConfig
    }
} as const;

const toolRegistry = new Map<string, ToolState>();
let lastRenderedHash: string | undefined;

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
            label: 'ATM Control Center',
            role: 'button'
        };

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.STATUS_CLICKED, handleStatusBarClick),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL, () => applyLayout(CONSTANTS.LAYOUTS.NORMAL)),
            vscode.commands.registerCommand(CONSTANTS.COMMANDS.LAYOUT_PRO, () => applyLayout(CONSTANTS.LAYOUTS.PRO))
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

        console.log('[ATM] Status bar activated successfully');
    } catch (error) {
        console.error('[ATM] Failed to activate status bar:', error);
        vscode.window.showErrorMessage('ATM: Failed to initialize status bar');
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

    toolRegistry.set(state.id, state);
    scheduleRender();
    console.log(`[ATM] Tool registered: ${state.name} (${state.id})`);
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
        vscode.window.showErrorMessage('ATM: Failed to open control menu');
    }
}

/**
 * Shows the ATM control center quick pick menu
 */
async function showQuickMenu(): Promise<void> {
    const isPro = checkIsPro();
    const items: vscode.QuickPickItem[] = [];

    // Layout Section
    items.push({ label: 'Layouts', kind: vscode.QuickPickItemKind.Separator });
    items.push({
        label: !isPro ? '$(pass-filled) Normal Layout' : '$(circle-outline) Normal Layout',
        description: 'Sidebar Left / Activity Bar Left',
        alwaysShow: true
    });
    items.push({
        label: isPro ? '$(pass-filled) Pro Layout' : '$(circle-outline) Pro Layout',
        description: 'Sidebar Right / Activity Bar Top',
        alwaysShow: true
    });

    // Tools Section
    if (toolRegistry.size > 0) {
        items.push({ label: 'Active Tools', kind: vscode.QuickPickItemKind.Separator });
        for (const [_, state] of toolRegistry) {
            items.push({
                label: `${state.icon} ${state.name}`,
                description: state.description,
                detail: `Command: ${state.command}`
            });
        }
    }

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'ATM Control Center',
        title: 'ATM Control',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (!selected) {
        return;
    }

    // Handle selection
    try {
        if (selected.label.includes('Normal Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_NORMAL);
        } else if (selected.label.includes('Pro Layout')) {
            await vscode.commands.executeCommand(CONSTANTS.COMMANDS.LAYOUT_PRO);
        } else if (selected.detail?.startsWith('Command: ')) {
            const cmd = selected.detail.replace('Command: ', '').trim();
            if (cmd) {
                await vscode.commands.executeCommand(cmd);
            }
        }
    } catch (error) {
        console.error('[ATM] Error executing command:', error);
        vscode.window.showErrorMessage(`ATM: Failed to execute command`);
    }
}

/**
 * Applies a layout configuration to the workbench
 * @param layout - The layout configuration to apply
 */
async function applyLayout(layout: LayoutConfig): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('workbench');
        
        await Promise.all([
            config.update('sideBar.location', layout.sideBarLocation, vscode.ConfigurationTarget.Global),
            config.update('activityBar.location', layout.activityBarLocation, vscode.ConfigurationTarget.Global)
        ]);

        const layoutName = layout === CONSTANTS.LAYOUTS.PRO ? 'Pro' : 'Normal';
        vscode.window.showInformationMessage(`ATM: ${layoutName} layout applied`);
        console.log(`[ATM] Layout applied: ${layoutName}`);
    } catch (error) {
        console.error('[ATM] Failed to apply layout:', error);
        vscode.window.showErrorMessage('ATM: Failed to apply layout. Check permissions.');
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
        (state.description === undefined || typeof state.description === 'string')
    );
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
    return `${isPro}:${toolIds}:${toolRegistry.size}`;
}

/**
 * Renders the hover UI tooltip for the status bar
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

        // Header
        md.appendMarkdown('### **ATM** &nbsp; $(verified-filled)\n\n');

        // Tools Section
        if (toolRegistry.size === 0) {
            md.appendMarkdown('_No active tools detected_\n\n');
        } else {
            for (const [_, state] of toolRegistry) {
                const desc = state.description 
                    ? ` <span style="color:#888888;">— ${escapeMarkdown(state.description)}</span>` 
                    : '';
                md.appendMarkdown(
                    `${state.icon} &nbsp; **[${escapeMarkdown(state.name)}](command:${state.command})** ${desc}\n\n`
                );
            }
        }

        md.appendMarkdown('<hr>\n\n');

        // Layout Section
        const isPro = checkIsPro();
        const normalItem = !isPro 
            ? `$(pass-filled) **Normal**` 
            : `$(circle-outline) [Normal](command:${CONSTANTS.COMMANDS.LAYOUT_NORMAL})`;
        const proItem = isPro 
            ? `$(pass-filled) **Pro**` 
            : `$(circle-outline) [Pro](command:${CONSTANTS.COMMANDS.LAYOUT_PRO})`;

        md.appendMarkdown(`**Current Layout:** &nbsp; ${normalItem} &nbsp; | &nbsp; ${proItem}\n\n`);

        md.appendMarkdown('<hr>\n\n');

        // Footer
        md.appendMarkdown(
            `<sub><span style="color:#569CD6;">$(pulse)</span> ` +
            `<span style="color:#888888;">Core systems online and monitoring. Click for Control Center.</span></sub>`
        );

        globalStatusBarItem.tooltip = md;
        globalStatusBarItem.text = CONSTANTS.STATUS_BAR_TEXT;

        // Visual feedback for active tools
        if (toolRegistry.size > 0) {
            globalStatusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        } else {
            globalStatusBarItem.color = undefined;
        }
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

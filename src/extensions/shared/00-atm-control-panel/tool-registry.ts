import { CONSTANTS } from './utils';
import { scheduleRender } from './status-bar';

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
 * Statistics about tool usage
 */
export interface ToolStats {
    totalTools: number;
    activeTools: number;
    categoryCounts: Map<string, number>;
}

export const toolRegistry = new Map<string, ToolState>();

/**
 * Registers or updates a tool in the status bar registry
 */
export function updateToolState(state: ToolState): void {
	if (!isValidToolState(state)) {
		console.error('[ATM] Invalid tool state:', state);
		throw new Error(`Invalid tool state: missing required fields`);
	}

	if (state.id === 'bracket-lynx') {
		state = { ...state, command: CONSTANTS.COMMANDS.BRACKET_LYNX_CONTROL_PANEL_TOGGLE };
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
 * Gets statistics about registered tools
 */
export function getToolStats(): ToolStats {
    const categoryCounts = new Map<string, number>();
    let activeCount = 0;

    for (const tool of toolRegistry.values()) {
        const category = tool.category || 'other';
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

        // Count as active if description indicates active state
        const desc = tool.description?.toLowerCase() || '';
        if (desc.includes('active') || desc.includes('enabled') || desc.includes('running')) {
            activeCount++;
        }
    }

    return {
        totalTools: toolRegistry.size,
        activeTools: activeCount,
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

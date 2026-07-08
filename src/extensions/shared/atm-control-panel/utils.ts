import * as vscode from 'vscode';
import type { ToolState } from './tool-registry';

export type { ToolState } from './tool-registry';
export { updateToolState, removeToolState, getToolStats, organizeToolsByCategory } from './tool-registry';
export {
    activateGlobalStatusBar,
    deactivateGlobalStatusBar,
    checkIsPro,
    getCurrentTerminalSoundAudio,
    setTerminalSoundAudio,
} from './status-bar';

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
    isTailwindFoldEnabled: boolean;
    isTailwindAutoFold: boolean;
    isBracketLynxEnabled: boolean;
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
        TERMINAL_SOUND_TEST_AUDIO: 'atm.terminalSound.testAudio',
        TERMINAL_SOUND_TOGGLE_MUTE: 'atm.terminalSound.toggleMute',
		TAILWIND_TOGGLE_AUTO_FOLD: 'tailwind-css.toggleAutoFold',
		TAILWIND_TOGGLE_ENABLED: 'tailwind-css.toggleEnabled',
		BRACKET_LYNX_TOGGLE: 'atm.bracketLynx.toggle',
		BRACKET_LYNX_CONTROL_PANEL_TOGGLE: 'atm.controlPanel.bracketLynxToggle'
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
        { id: 'faah', name: 'Faah', fileName: 'faah.wav', icon: '$(megaphone)' }
    ] as TerminalSoundAudioOption[],
    CATEGORIES: {
        productivity: { icon: '$(rocket)', label: 'Productivity' },
        debugging: { icon: '$(bug)', label: 'Debugging' },
        ui: { icon: '$(paintcan)', label: 'UI/UX' },
        analysis: { icon: '$(graph)', label: 'Analysis' },
        other: { icon: '$(tools)', label: 'Other' }
    }
} as const;

/**
 * Escapes markdown special characters
 */
export function escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

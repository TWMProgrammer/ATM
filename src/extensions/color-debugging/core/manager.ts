import * as vscode from 'vscode';
import { debugColors } from './colorList';

/* =========================================================
 * ⚙️ CONFIG KEYS
 * ========================================================= */
const BACKGROUND_KEYS = [
    "activityBar.background",
    "statusBar.background",
    "statusBar.noFolderBackground"
];

const FOREGROUND_KEYS = [
    "activityBar.foreground",
    "activityBar.inactiveForeground",
    "statusBar.foreground"
];

/* =========================================================
 * 🎨 COLOR UTILITIES
 * ========================================================= */
function getContrastColor(hexColor: string): string {
    // Convert #RRGGBB or #RRGGBBAA
    const hex = hexColor.replace('#', '').substring(0, 6);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

export function hasColorApplied(): boolean {
    const config = vscode.workspace.getConfiguration('workbench');
    const colorCustomizations = config.get<any>('colorCustomizations', {});
    return isOurColor(colorCustomizations);
}

// Prevent immediate consecutive repeats
let lastAppliedColor: string | null = null;

function isOurColor(colorCustomizations: any): boolean {
    const currentColor = colorCustomizations["activityBar.background"];
    if (!currentColor) {
        return false;
    }
    
    // Check if the current color is in our debugColors array (case-insensitive)
    return debugColors.map(c => c.toLowerCase()).includes(currentColor.toLowerCase());
}

/* =========================================================
 * 🧹 CLEANUP WORKSPACE COLORS
 * ========================================================= */
export async function clearWorkspaceColors(): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    const colorCustomizations = config.get<any>('colorCustomizations', {});

    // Only clean up if we actually applied our color
    if (!isOurColor(colorCustomizations)) {
        return;
    }

    const newCustomizations = { ...colorCustomizations };
    
    [...BACKGROUND_KEYS, ...FOREGROUND_KEYS].forEach(key => {
        newCustomizations[key] = undefined;
    });
    // Clean up any old keys from previous version (titleBar)
    newCustomizations["titleBar.activeBackground"] = undefined;
    newCustomizations["titleBar.inactiveBackground"] = undefined;

    const remainingKeys = Object.keys(newCustomizations).filter(k => newCustomizations[k] !== undefined);
    
    if (remainingKeys.length === 0) {
        await config.update('colorCustomizations', undefined, vscode.ConfigurationTarget.Workspace);
    } else {
        await config.update('colorCustomizations', newCustomizations, vscode.ConfigurationTarget.Workspace);
    }
    
    lastAppliedColor = null;
}

/* =========================================================
 * 🎲 APPLY RANDOM COLOR
 * ========================================================= */
export async function applyRandomColor(): Promise<void> {
    // Pick a random color different from the last applied one
    const availableColors = lastAppliedColor 
        ? debugColors.filter(c => c !== lastAppliedColor)
        : debugColors;
        
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
    lastAppliedColor = randomColor;
    
    const config = vscode.workspace.getConfiguration('workbench');
    const colorCustomizations = config.get<any>('colorCustomizations', {});

    const newCustomizations = { ...colorCustomizations };
    
    const contrastColor = getContrastColor(randomColor);
    
    BACKGROUND_KEYS.forEach(key => {
        newCustomizations[key] = randomColor;
    });
    FOREGROUND_KEYS.forEach(key => {
        newCustomizations[key] = contrastColor;
    });

    await config.update('colorCustomizations', newCustomizations, vscode.ConfigurationTarget.Workspace);
}

/**
 * Path resolution utilities for Voice TTS extension
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG_SECTION, DEFAULT_VOICE } from './config';
import type { PlaybackCommand } from './types';

/**
 * Get the base path where piper/ and voices/ directories are located.
 * First tries extension root; falls back to piper-tts/Piper_TTS-main for development.
 */
export function getResourcesBasePath(context: vscode.ExtensionContext): string {
    const extPath = context.extensionUri.fsPath;
    const atRoot = path.join(extPath, 'piper');
    
    if (fs.existsSync(atRoot)) {
        return extPath;
    }
    
    const fallback = path.join(extPath, 'piper-tts', 'Piper_TTS-main');
    if (fs.existsSync(path.join(fallback, 'piper'))) {
        return fallback;
    }
    
    return extPath;
}

/**
 * Get the path to the Piper executable for the current platform.
 */
export function getPiperPath(context: vscode.ExtensionContext): string {
    const platform = os.platform();
    const arch = os.arch();
    const baseDir = getResourcesBasePath(context);

    let piperPath: string;
    
    switch (platform) {
        case 'win32':
            piperPath = path.join(baseDir, 'piper', 'windows_amd64', 'piper.exe');
            break;
        case 'darwin':
            piperPath = arch === 'arm64'
                ? path.join(baseDir, 'piper', 'macos_aarch64', 'piper')
                : path.join(baseDir, 'piper', 'macos_x64', 'piper');
            break;
        case 'linux':
            if (arch === 'arm64') {
                piperPath = path.join(baseDir, 'piper', 'linux_aarch64', 'piper');
            } else if (arch === 'arm') {
                piperPath = path.join(baseDir, 'piper', 'linux_armv7l', 'piper');
            } else {
                piperPath = path.join(baseDir, 'piper', 'linux_x86_64', 'piper');
            }
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
    
    return piperPath;
}

/**
 * Get the path to the currently configured voice model.
 */
export function getVoicePath(context: vscode.ExtensionContext): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const selectedVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
    const baseDir = getResourcesBasePath(context);
    return path.join(baseDir, 'voices', `${selectedVoice}.onnx`);
}

/**
 * Get the voices directory path.
 */
export function getVoicesDir(context: vscode.ExtensionContext): string {
    const baseDir = getResourcesBasePath(context);
    return path.join(baseDir, 'voices');
}

/**
 * Get the playback command configuration for the current platform.
 */
export function getPlaybackCommand(context: vscode.ExtensionContext): PlaybackCommand {
    const platform = os.platform();
    const baseDir = getResourcesBasePath(context);

    switch (platform) {
        case 'win32': {
            const playPath = path.join(baseDir, 'sox', 'play.exe');
            return {
                command: playPath,
                args: ['-t', 'raw', '-r', '22050', '-b', '16', '-e', 'signed', '-c', '1', '-L', '-', 'remix', '1']
            };
        }
        case 'darwin':
            return { command: 'afplay', args: ['-'] };
        case 'linux':
            return { command: 'aplay', args: ['-r', '22050', '-f', 'S16_LE', '-t', 'raw', '-'] };
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

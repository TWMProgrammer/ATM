/**
 * Audio playback management for Voice TTS extension
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getPiperPath, getVoicePath, getPlaybackCommand } from './paths';

let piperProcess: ChildProcess | undefined;
let playerProcess: ChildProcess | undefined;

/**
 * Stop any currently running TTS playback.
 */
export function stopCurrentPlayback(): void {
    try {
        if (piperProcess && !piperProcess.killed) {
            piperProcess.kill();
            piperProcess = undefined;
        }
        if (playerProcess && !playerProcess.killed) {
            playerProcess.kill();
            playerProcess = undefined;
        }
    } catch (error) {
        console.error('[voice-tts] Error stopping playback:', error);
        piperProcess = undefined;
        playerProcess = undefined;
    }
}

/**
 * Read text aloud using the Piper TTS engine.
 */
export async function readText(context: vscode.ExtensionContext, text: string): Promise<void> {
    if (!text) {
        throw new Error('No text provided');
    }

    stopCurrentPlayback();
    await new Promise(resolve => setTimeout(resolve, 100));

    const piperPath = getPiperPath(context);
    const voicePath = getVoicePath(context);

    // Validate paths
    if (!fs.existsSync(piperPath)) {
        throw new Error(`Piper executable not found at: ${piperPath}`);
    }
    if (!fs.existsSync(voicePath)) {
        throw new Error(`Voice model not found at: ${voicePath}. Use "ATM Voice TTS: Download Voice" to add one.`);
    }

    // Verify voice model is accessible
    try {
        const fd = fs.openSync(voicePath, 'r');
        fs.closeSync(fd);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Voice model file is not accessible: ${msg}`);
    }

    const playback = getPlaybackCommand(context);
    
    const piper = spawn(piperPath, ['--model', voicePath, '--output-raw'], {
        cwd: path.dirname(piperPath),
        env: { ...process.env },
        windowsHide: false
    });
    piperProcess = piper;

    const player = spawn(playback.command, playback.args);
    playerProcess = player;

    piper.stdout.pipe(player.stdin);
    piper.stdin.write(text);
    piper.stdin.end();

    return new Promise((resolve, reject) => {
        piper.on('error', reject);
        player.on('error', reject);
        
        piper.on('close', (code) => {
            piperProcess = undefined;
            if (code !== 0 && code !== null) {
                reject(new Error(`Piper process exited with code: ${code}`));
            } else {
                resolve();
            }
        });
        
        player.on('close', (code) => {
            playerProcess = undefined;
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Player process exited with code: ${code}`));
            }
        });
    });
}

/**
 * Check if playback is currently active.
 */
export function isPlaying(): boolean {
    return (piperProcess !== undefined && !piperProcess.killed) ||
           (playerProcess !== undefined && !playerProcess.killed);
}

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { fixSymlinks } from './symlinkUtils';

const CONFIG_SECTION = 'atm.voiceTts';
const DEFAULT_VOICE = 'en_US-hfc_female-medium';

let piperProcess: ReturnType<typeof spawn> | undefined;
let playerProcess: ReturnType<typeof spawn> | undefined;

/**
 * Base path donde están piper/ y voices/.
 * Primero intenta la raíz de la extensión; luego piper-tts/Piper_TTS-main para desarrollo.
 */
function getResourcesBasePath(context: vscode.ExtensionContext): string {
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

function getAvailableVoices(context: vscode.ExtensionContext): string[] {
    const baseDir = getResourcesBasePath(context);
    const voicesDir = path.join(baseDir, 'voices');

    try {
        if (!fs.existsSync(voicesDir)) {return [];}
        const files = fs.readdirSync(voicesDir);
        return files
            .filter(file => file.endsWith('.onnx'))
            .map(file => path.basename(file, '.onnx'));
    } catch (error) {
        console.error('[voice-tts] Error reading voices directory:', error);
        return [];
    }
}

function getVoiceLabel(voice: string): string {
    const parts = voice.split('-');
    const locale = parts[0].replace('_', ' ');
    const name = parts[1]?.replace(/_/g, ' ') ?? '';
    const quality = parts[2] ?? '';
    return `${locale} - ${name} (${quality})`;
}

function downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        if (fs.existsSync(destination)) {
            try {
                fs.unlinkSync(destination);
            } catch (err) {
                console.error(`[voice-tts] Error removing existing file ${destination}:`, err);
            }
        }

        const file = fs.createWriteStream(destination, { flags: 'wx' });

        const request = protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307) {
                if (response.headers.location) {
                    const redirectUrl = new URL(response.headers.location, url).toString();
                    file.close();
                    downloadFile(redirectUrl, destination).then(resolve).catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(destination, () => {});
                reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.end(() => {
                    file.close();
                    try {
                        const stats = fs.statSync(destination);
                        if (stats.size === 0) {
                            reject(new Error(`Downloaded file is empty: ${destination}`));
                            return;
                        }
                        resolve();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        reject(new Error(`Error verifying downloaded file: ${errorMessage}`));
                    }
                });
            });
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(destination, () => {});
            reject(err);
        });

        file.on('error', (err) => {
            file.close();
            fs.unlink(destination, () => {});
            reject(err);
        });
    });
}

const VOICES_JSON_URL = 'https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json';

async function loadVoicesData(context: vscode.ExtensionContext): Promise<Record<string, unknown>> {
    const baseDir = getResourcesBasePath(context);
    const voicesDir = path.join(baseDir, 'voices');
    const voicesJsonPath = path.join(voicesDir, 'voices.json');

    // If voices.json exists locally, read it
    if (fs.existsSync(voicesJsonPath)) {
        try {
            const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
            return JSON.parse(voicesJson) as Record<string, unknown>;
        } catch (error) {
            console.error('[voice-tts] Error parsing local voices.json:', error);
        }
    }

    // Download voices.json from HuggingFace
    console.log('[voice-tts] voices.json not found locally, downloading from HuggingFace...');
    if (!fs.existsSync(voicesDir)) {
        fs.mkdirSync(voicesDir, { recursive: true });
    }

    try {
        await downloadFile(VOICES_JSON_URL, voicesJsonPath);
        const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
        return JSON.parse(voicesJson) as Record<string, unknown>;
    } catch (error) {
        console.error('[voice-tts] Error downloading voices.json:', error);
        throw new Error('Failed to download voices catalog. Check your internet connection and try again.');
    }
}

async function downloadVoice(context: vscode.ExtensionContext): Promise<void> {
    try {
        const voicesData = await loadVoicesData(context);
        const languages = Object.keys(voicesData);

        const selectedLanguage = await vscode.window.showQuickPick(languages, {
            placeHolder: 'Select a language',
        });
        if (!selectedLanguage) {return;}

        const voices = Object.keys(voicesData[selectedLanguage] as Record<string, unknown>);
        const selectedVoice = await vscode.window.showQuickPick(voices, {
            placeHolder: `Select a voice for ${selectedLanguage}`,
        });
        if (!selectedVoice) {return;}

        const langEntry = voicesData[selectedLanguage] as Record<string, Record<string, { model: string; config: string }>>;
        const modelSizes = Object.keys(langEntry[selectedVoice]);
        const selectedSize = await vscode.window.showQuickPick(modelSizes, {
            placeHolder: `Select a model size for ${selectedVoice}`,
        });
        if (!selectedSize) {return;}

        const modelUrl = langEntry[selectedVoice][selectedSize].model;
        const configUrl = langEntry[selectedVoice][selectedSize].config;

        const languageCode = selectedLanguage.match(/\(([^)]+)\)/)?.[1] ?? '';
        const voiceId = `${languageCode}-${selectedVoice}-${selectedSize}`;

        const baseDir = getResourcesBasePath(context);
        const voicesDir = path.join(baseDir, 'voices');
        if (!fs.existsSync(voicesDir)) {
            fs.mkdirSync(voicesDir, { recursive: true });
        }

        const modelPath = path.join(voicesDir, `${voiceId}.onnx`);
        const configPath = path.join(voicesDir, `${voiceId}.onnx.json`);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${voiceId}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading model file...' });
            await downloadFile(modelUrl, modelPath);
            progress.report({ message: 'Downloading config file...', increment: 50 });
            await downloadFile(configUrl, configPath);
            progress.report({ message: 'Download complete', increment: 50 });
        });

        stopCurrentPlayback();
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
            throw new Error('Downloaded voice files not found or not accessible');
        }

        await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
            'voice',
            voiceId,
            vscode.ConfigurationTarget.Global
        );

        vscode.window.showInformationMessage(`Voice ${voiceId} has been downloaded and set as the current voice.`);
    } catch (error) {
        console.error('[voice-tts] Error downloading voice:', error);
        vscode.window.showErrorMessage('Failed to download voice: ' + (error instanceof Error ? error.message : String(error)));
    }
}

async function selectVoice(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    if (voices.length === 0) {
        vscode.window.showErrorMessage('No voice models found. Use "ATM Voice TTS: Download Voice" to add one.');
        return;
    }

    const items = voices.map(voice => ({
        label: getVoiceLabel(voice),
        description: voice,
    }));

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a voice for text-to-speech',
    });

    if (selection) {
        await vscode.workspace.getConfiguration(CONFIG_SECTION).update(
            'voice',
            selection.description,
            vscode.ConfigurationTarget.Global
        );
    }
}

function getPiperPath(context: vscode.ExtensionContext): string {
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

function getVoicePath(context: vscode.ExtensionContext): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const selectedVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
    const baseDir = getResourcesBasePath(context);
    return path.join(baseDir, 'voices', `${selectedVoice}.onnx`);
}

function getPlaybackCommand(context: vscode.ExtensionContext): { command: string; args: string[] } {
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

function stopCurrentPlayback(): void {
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

async function removeVoice(context: vscode.ExtensionContext): Promise<void> {
    const voices = getAvailableVoices(context);
    if (voices.length === 0) {
        vscode.window.showErrorMessage('No voice models found in the voices directory');
        return;
    }

    const items = voices.map(voice => ({
        label: getVoiceLabel(voice),
        description: voice,
    }));

    const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a voice to remove',
    });

    if (selection) {
        const voiceId = selection.description;
        const baseDir = getResourcesBasePath(context);
        const modelPath = path.join(baseDir, 'voices', `${voiceId}.onnx`);
        const configPath = path.join(baseDir, 'voices', `${voiceId}.onnx.json`);

        try {
            if (fs.existsSync(modelPath)) {fs.unlinkSync(modelPath);}
            if (fs.existsSync(configPath)) {fs.unlinkSync(configPath);}
            vscode.window.showInformationMessage(`Voice ${voiceId} has been removed.`);

            const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
            const currentVoice = config.get<string>('voice');
            if (currentVoice === voiceId) {
                await config.update('voice', DEFAULT_VOICE, vscode.ConfigurationTarget.Global);
            }
        } catch (error) {
            console.error('[voice-tts] Error removing voice:', error);
            vscode.window.showErrorMessage('Failed to remove voice: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}

export interface VoiceTtsApi {
    readText(text: string): Promise<void>;
    stopPlayback(): void;
    selectVoice(): Promise<void>;
    downloadVoice(): Promise<void>;
    removeVoice(): Promise<void>;
}

export function activateVoiceTts(context: vscode.ExtensionContext): VoiceTtsApi {
    const basePath = getResourcesBasePath(context);

    if (os.platform() === 'linux') {
        fixSymlinks(basePath).catch(error => {
            console.error('[voice-tts] Failed to fix symbolic links:', error);
        });
    }

    if (os.platform() === 'linux' || os.platform() === 'darwin') {
        try {
            const piperPath = getPiperPath(context);
            if (fs.existsSync(piperPath)) {
                fs.chmodSync(piperPath, 0o755);
            }
            const binDir = path.dirname(piperPath);
            for (const binary of ['espeak-ng', 'piper_phonemize']) {
                const binaryPath = path.join(binDir, binary);
                if (fs.existsSync(binaryPath)) {
                    fs.chmodSync(binaryPath, 0o755);
                }
            }
        } catch (error) {
            console.error('[voice-tts] Error setting execute permissions:', error);
        }
    }

    const api: VoiceTtsApi = {
        readText: async (text: string) => {
            if (!text) {throw new Error('No text provided');}
            stopCurrentPlayback();
            await new Promise(resolve => setTimeout(resolve, 100));

            const piperPath = getPiperPath(context);
            const voicePath = getVoicePath(context);

            if (!fs.existsSync(piperPath)) {
                throw new Error(`Piper executable not found at: ${piperPath}`);
            }
            if (!fs.existsSync(voicePath)) {
                throw new Error(`Voice model not found at: ${voicePath}. Use "ATM Voice TTS: Download Voice" to add one.`);
            }
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
                    if (code !== 0 && code !== null) {reject(new Error(`Piper process exited with code: ${code}`));}
                    else {resolve();}
                });
                player.on('close', (code) => {
                    playerProcess = undefined;
                    if (code === 0) {resolve();}
                    else {reject(new Error(`Player process exited with code: ${code}`));}
                });
            });
        },
        stopPlayback: () => stopCurrentPlayback(),
        selectVoice: () => selectVoice(context),
        downloadVoice: () => downloadVoice(context),
        removeVoice: () => removeVoice(context)
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('atm.voiceTts.selectVoice', () => api.selectVoice()),
        vscode.commands.registerCommand('atm.voiceTts.readAloud', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {return;}
            const text = editor.document.getText(editor.selection);
            if (!text) {
                vscode.window.showInformationMessage('Please select some text to read aloud');
                return;
            }
            try {
                await api.readText(text);
            } catch (error) {
                vscode.window.showErrorMessage('Error running text-to-speech: ' + (error instanceof Error ? error.message : String(error)));
            }
        }),
        vscode.commands.registerCommand('atm.voiceTts.stopPlayback', () => api.stopPlayback()),
        vscode.commands.registerCommand('atm.voiceTts.downloadVoice', () => api.downloadVoice()),
        vscode.commands.registerCommand('atm.voiceTts.removeVoice', () => api.removeVoice())
    );

    return api;
}

export function deactivateVoiceTts(): void {
    stopCurrentPlayback();
}

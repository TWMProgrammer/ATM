import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import type {
  VoicesCatalog,
  CatalogVoiceEntry,
  VoiceDownloadUrls,
  PlaybackCommand,
  PresetLanguage,
} from './types';

// ─── Configuration ──────────────────────────────────────────────────

export const CONFIG_SECTION = 'atm.voiceTts';
export const DEFAULT_VOICE = 'en_US-hfc_female-medium';
export const VOICES_JSON_URL =
  'https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json';
export const VOICES_DOWNLOAD_BASE_URL =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/';

export const PRESET_LANGUAGES: PresetLanguage[] = [
  {
    label: '🇺🇸 English (US)',
    shortCode: 'EN',
    catalogKey: 'en_US',
    recommendedVoices: [
      {
        name: 'hfc_female',
        label: 'HFC Female',
        quality: 'medium',
        description: 'Clear female voice — medium quality',
      },
    ],
  },
  {
    label: '🇵🇪 Español (PE)',
    shortCode: 'ES',
    catalogKey: 'es_MX',
    recommendedVoices: [
      {
        name: 'ald',
        label: 'Ald',
        quality: 'medium',
        description: 'Male voice — medium quality',
      },
    ],
  },
];

// ─── Paths ──────────────────────────────────────────────────────────

export function getResourcesBasePath(context: vscode.ExtensionContext): string {
  const globalDir = context.globalStorageUri.fsPath;

  if (!fs.existsSync(globalDir)) {
    fs.mkdirSync(globalDir, { recursive: true });
  }

  return globalDir;
}

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
      piperPath =
        arch === 'arm64'
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

export function getVoicePath(context: vscode.ExtensionContext): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const selectedVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
  const baseDir = getResourcesBasePath(context);
  return path.join(baseDir, 'voices', `${selectedVoice}.onnx`);
}

export function getVoicesDir(context: vscode.ExtensionContext): string {
  const baseDir = getResourcesBasePath(context);
  return path.join(baseDir, 'voices');
}

export function getPlaybackCommand(
  context: vscode.ExtensionContext,
): PlaybackCommand {
  const platform = os.platform();
  const baseDir = getResourcesBasePath(context);

  switch (platform) {
    case 'win32': {
      const playPath = path.join(
        baseDir,
        'piper',
        'windows_amd64',
        'sox',
        'play.exe',
      );
      return {
        command: playPath,
        args: [
          '-t',
          'raw',
          '-r',
          '22050',
          '-b',
          '16',
          '-e',
          'signed',
          '-c',
          '1',
          '-L',
          '-',
          'remix',
          '1',
        ],
      };
    }
    case 'darwin':
      return { command: 'afplay', args: ['-'] };
    case 'linux':
      return {
        command: 'aplay',
        args: ['-r', '22050', '-f', 'S16_LE', '-t', 'raw', '-'],
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ─── Voices Management ──────────────────────────────────────────────

export function getAvailableVoices(context: vscode.ExtensionContext): string[] {
  const voicesDir = getVoicesDir(context);

  try {
    if (!fs.existsSync(voicesDir)) {
      return [];
    }
    const files = fs.readdirSync(voicesDir);
    return files
      .filter((file) => file.endsWith('.onnx'))
      .map((file) => path.basename(file, '.onnx'));
  } catch (error) {
    console.error('[voice-tts] Error reading voices directory:', error);
    return [];
  }
}

export function getVoiceLabel(voice: string): string {
  const parts = voice.split('-');
  const locale = parts[0].replace('_', ' ');
  const name = parts[1]?.replace(/_/g, ' ') ?? '';
  const quality = parts[2] ?? '';
  return `${locale} - ${name} (${quality})`;
}

export async function loadVoicesCatalog(
  context: vscode.ExtensionContext,
): Promise<VoicesCatalog> {
  const voicesDir = getVoicesDir(context);
  const voicesJsonPath = path.join(voicesDir, 'voices.json');

  if (fs.existsSync(voicesJsonPath)) {
    try {
      const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
      return JSON.parse(voicesJson) as VoicesCatalog;
    } catch (error) {
      console.error('[voice-tts] Error parsing local voices.json:', error);
    }
  }

  console.log('[voice-tts] Downloading voices.json from HuggingFace...');

  if (!fs.existsSync(voicesDir)) {
    fs.mkdirSync(voicesDir, { recursive: true });
  }

  try {
    // Dynamic import to avoid circular dependency
    const { downloadFile } = await import('./installer.js');
    await downloadFile(VOICES_JSON_URL, voicesJsonPath);
    const voicesJson = fs.readFileSync(voicesJsonPath, 'utf8');
    return JSON.parse(voicesJson) as VoicesCatalog;
  } catch (error) {
    console.error('[voice-tts] Error downloading voices.json:', error);
    throw new Error(
      'Failed to download voices catalog. Check your internet connection.',
    );
  }
}

export function lookupVoice(
  catalog: VoicesCatalog,
  voiceId: string,
): CatalogVoiceEntry | null {
  return catalog[voiceId] ?? null;
}

export function resolveDownloadUrls(
  entry: CatalogVoiceEntry,
): VoiceDownloadUrls | null {
  const files = Object.keys(entry.files);
  const onnxFile = files.find(
    (f) => f.endsWith('.onnx') && !f.endsWith('.onnx.json'),
  );
  const configFile = files.find((f) => f.endsWith('.onnx.json'));

  if (!onnxFile || !configFile) {
    return null;
  }

  return {
    modelUrl: `${VOICES_DOWNLOAD_BASE_URL}${onnxFile}`,
    configUrl: `${VOICES_DOWNLOAD_BASE_URL}${configFile}`,
    modelSizeBytes: entry.files[onnxFile].size_bytes,
  };
}

export function getVoiceFilePaths(
  context: vscode.ExtensionContext,
  voiceId: string,
): {
  modelPath: string;
  configPath: string;
} {
  const voicesDir = getVoicesDir(context);
  return {
    modelPath: path.join(voicesDir, `${voiceId}.onnx`),
    configPath: path.join(voicesDir, `${voiceId}.onnx.json`),
  };
}

export function isVoiceInstalled(
  context: vscode.ExtensionContext,
  voiceId: string,
): boolean {
  const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);
  return fs.existsSync(modelPath) && fs.existsSync(configPath);
}

export function deleteVoiceFiles(
  context: vscode.ExtensionContext,
  voiceId: string,
): void {
  const { modelPath, configPath } = getVoiceFilePaths(context, voiceId);

  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath);
  }
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

// ─── Playback ───────────────────────────────────────────────────────

let piperProcess: ChildProcess | undefined;
let playerProcess: ChildProcess | undefined;
let stoppedByUser = false;

export function stopCurrentPlayback(): void {
  stoppedByUser = true;
  try {
    if (piperProcess && playerProcess) {
      piperProcess.stdout?.unpipe(playerProcess.stdin ?? undefined);
      playerProcess.stdin?.destroy();
    }
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

export async function readText(
  context: vscode.ExtensionContext,
  text: string,
): Promise<void> {
  if (!text) {
    throw new Error('No text provided');
  }

  stopCurrentPlayback();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const piperPath = getPiperPath(context);
  const voicePath = getVoicePath(context);

  if (!fs.existsSync(piperPath)) {
    throw new Error(`Piper executable not found at: ${piperPath}`);
  }
  if (!fs.existsSync(voicePath)) {
    throw new Error(
      `Voice model not found. Use "ATM Voice TTS: Download Voice" to add one.`,
    );
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
    windowsHide: false,
  });
  piperProcess = piper;

  const player = spawn(playback.command, playback.args);
  playerProcess = player;

  const noop = () => {};
  piper.stdout.on('error', noop);
  player.stdin.on('error', noop);

  piper.stdout.pipe(player.stdin);
  piper.stdin.write(text);
  piper.stdin.end();

  stoppedByUser = false;

  return new Promise((resolve, reject) => {
    let settled = false;
    let piperClosed = false;
    let playerClosed = false;

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const rejectOnce = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const maybeFinish = () => {
      if (stoppedByUser) {
        resolveOnce();
        return;
      }
      if (piperClosed && playerClosed) {
        resolveOnce();
      }
    };

    piper.on('error', (err) => {
      if (!stoppedByUser) {
        stopCurrentPlayback();
        rejectOnce(err);
      } else {
        resolveOnce();
      }
    });
    player.on('error', (err) => {
      if (!stoppedByUser) {
        stopCurrentPlayback();
        rejectOnce(err);
      } else {
        resolveOnce();
      }
    });

    piper.on('close', (code) => {
      piperProcess = undefined;
      if (stoppedByUser) {
        piperClosed = true;
        maybeFinish();
      } else if (code !== 0 && code !== null) {
        piperClosed = true;
        stopCurrentPlayback();
        rejectOnce(new Error(`Piper process exited with code: ${code}`));
      } else {
        piperClosed = true;
        maybeFinish();
      }
    });

    player.on('close', (code) => {
      playerProcess = undefined;
      if (stoppedByUser || code === 0) {
        playerClosed = true;
        maybeFinish();
      } else {
        playerClosed = true;
        stopCurrentPlayback();
        rejectOnce(new Error(`Player process exited with code: ${code}`));
      }
    });
  });
}

export function isPlaying(): boolean {
  return (
    (piperProcess !== undefined && !piperProcess.killed) ||
    (playerProcess !== undefined && !playerProcess.killed)
  );
}

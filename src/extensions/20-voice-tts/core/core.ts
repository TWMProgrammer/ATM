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

/* =========================================================
 * ⚙️ CONFIGURATION
 * ========================================================= */

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
    catalogKey: 'es_ES',
    recommendedVoices: [
      {
        name: 'sharvard',
        label: 'Sharvard',
        quality: 'medium',
        description: 'Male voice — medium quality',
      },
    ],
  },
  {
    label: '🇨🇳 中文 (CN)',
    shortCode: 'ZH',
    catalogKey: 'zh_CN',
    recommendedVoices: [
      {
        name: 'huayan',
        label: 'Huayan',
        quality: 'medium',
        description: 'Clear Chinese voice — medium quality',
      },
    ],
  },
  {
    label: '🇷🇺 Русский',
    shortCode: 'RU',
    catalogKey: 'ru_RU',
    recommendedVoices: [
      {
        name: 'irina',
        label: 'Irina',
        quality: 'medium',
        description: 'Clear female Russian voice — medium quality',
      },
    ],
  },
  {
    label: '🇧🇷 Português',
    shortCode: 'PT',
    catalogKey: 'pt_BR',
    recommendedVoices: [
      {
        name: 'faber',
        label: 'Faber',
        quality: 'medium',
        description: 'Clear Brazilian Portuguese voice — medium quality',
      },
    ],
  },
  {
    label: '🇫🇷 Français',
    shortCode: 'FR',
    catalogKey: 'fr_FR',
    recommendedVoices: [
      {
        name: 'siwis',
        label: 'Siwis',
        quality: 'medium',
        description: 'Clear French voice — medium quality',
      },
    ],
  },
  {
    label: '🇩🇪 Deutsch',
    shortCode: 'DE',
    catalogKey: 'de_DE',
    recommendedVoices: [
      {
        name: 'thorsten',
        label: 'Thorsten',
        quality: 'medium',
        description: 'Clear German male voice — medium quality',
      },
    ],
  },
];

/* =========================================================
 * 📁 PATHS (ASYNC)
 * ========================================================= */

export async function getResourcesBasePath(
  context: vscode.ExtensionContext,
): Promise<string> {
  const globalDir = context.globalStorageUri.fsPath;

  try {
    await fs.promises.mkdir(globalDir, { recursive: true });
  } catch (error) {
    console.error('[voice-tts] Error creating storage directory:', error);
  }

  return globalDir;
}

// Pure path math shared by the "own" resolver and the sibling-storage scan below.
function computePiperExecutableFromBase(baseDir: string): string {
  const platform = os.platform();
  const arch = os.arch();

  switch (platform) {
    case 'win32':
      return path.join(baseDir, 'piper', 'windows_amd64', 'piper.exe');
    case 'darwin':
      return arch === 'arm64'
        ? path.join(baseDir, 'piper', 'macos_aarch64', 'piper')
        : path.join(baseDir, 'piper', 'macos_x64', 'piper');
    case 'linux':
      if (arch === 'arm64') {
        return path.join(baseDir, 'piper', 'linux_aarch64', 'piper');
      }
      if (arch === 'arm') {
        return path.join(baseDir, 'piper', 'linux_armv7l', 'piper');
      }
      return path.join(baseDir, 'piper', 'linux_x86_64', 'piper');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function getPiperPath(
  context: vscode.ExtensionContext,
): Promise<string> {
  const baseDir = await getResourcesBasePath(context);
  return computePiperExecutableFromBase(baseDir);
}

// Sibling bastndev.* extensions (e.g. bastndev.f1) that share the same
// globalStorage root and may already have Piper/voices installed.
async function getSiblingBastndevDirs(
  context: vscode.ExtensionContext,
): Promise<string[]> {
  const ownDir = context.globalStorageUri.fsPath;
  const storageRoot = path.dirname(ownDir);
  const ownName = path.basename(ownDir);
  const dirs: string[] = [];

  try {
    const entries = await fs.promises.readdir(storageRoot, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        entry.name.startsWith('bastndev.') &&
        entry.name !== ownName
      ) {
        dirs.push(path.join(storageRoot, entry.name));
      }
    }
  } catch {
    // storage root unreadable — no siblings to reuse
  }

  return dirs;
}

/**
 * Resolves a working Piper executable: prefers this extension's own install,
 * falls back to a sibling bastndev.* extension's install to avoid re-downloading
 * the ~20MB engine. Falls back to the (possibly nonexistent) own path so
 * callers get a stable value to report in error messages.
 */
export async function resolvePiperExecutablePath(
  context: vscode.ExtensionContext,
): Promise<string> {
  const ownPath = await getPiperPath(context);
  if (await fileExists(ownPath)) {
    return ownPath;
  }

  for (const dir of await getSiblingBastndevDirs(context)) {
    const candidate = computePiperExecutableFromBase(dir);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return ownPath;
}

export async function getVoicePath(
  context: vscode.ExtensionContext,
): Promise<string> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const selectedVoice = config.get<string>('voice') ?? DEFAULT_VOICE;
  const baseDir = await getResourcesBasePath(context);
  const ownPath = path.join(baseDir, 'voices', `${selectedVoice}.onnx`);
  if (await fileExists(ownPath)) {
    return ownPath;
  }
  // reuse the same voice downloaded by a sibling bastndev.* extension
  return (await resolveVoiceModelPath(context, selectedVoice)) ?? ownPath;
}

export async function getVoicesDir(
  context: vscode.ExtensionContext,
): Promise<string> {
  const baseDir = await getResourcesBasePath(context);
  return path.join(baseDir, 'voices');
}

export async function ensureVoicesDir(
  context: vscode.ExtensionContext,
): Promise<string> {
  const voicesDir = await getVoicesDir(context);
  await fs.promises.mkdir(voicesDir, { recursive: true });
  return voicesDir;
}

export async function getPlaybackCommand(
  context: vscode.ExtensionContext,
): Promise<PlaybackCommand> {
  const platform = os.platform();
  const baseDir = await getResourcesBasePath(context);

  switch (platform) {
    case 'win32': {
      const ownPlayPath = path.join(
        baseDir,
        'piper',
        'windows_amd64',
        'sox',
        'play.exe',
      );
      let playPath = ownPlayPath;
      if (!(await fileExists(ownPlayPath))) {
        for (const dir of await getSiblingBastndevDirs(context)) {
          const candidate = path.join(dir, 'piper', 'windows_amd64', 'sox', 'play.exe');
          if (await fileExists(candidate)) {
            playPath = candidate;
            break;
          }
        }
      }
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

/* =========================================================
 * 🔍 HELPER: FILE EXISTENCE CHECK
 * ========================================================= */

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
 * 🤝 SHARED VOICES (sibling bastndev.* extensions)
 * ========================================================= */

// Sibling extensions (e.g. bastndev.f1) store piper voices with the same
// layout: <globalStorage>/<publisher.ext>/voices/*.onnx(+.onnx.json).
// Reusing them avoids duplicate downloads across extensions.
export async function getSharedVoicesDirs(
  context: vscode.ExtensionContext,
): Promise<string[]> {
  const dirs: string[] = [];

  for (const siblingDir of await getSiblingBastndevDirs(context)) {
    const voicesDir = path.join(siblingDir, 'voices');
    if (await fileExists(voicesDir)) {
      dirs.push(voicesDir);
    }
  }

  return dirs;
}

// First dir containing both model and config wins; own dir has priority.
// Config json must sit next to the model (piper resolves <model>.json).
export async function resolveVoiceModelPath(
  context: vscode.ExtensionContext,
  voiceId: string,
): Promise<string | null> {
  const dirs = [
    await getVoicesDir(context),
    ...(await getSharedVoicesDirs(context)),
  ];

  for (const dir of dirs) {
    const modelPath = path.join(dir, `${voiceId}.onnx`);
    if (
      (await fileExists(modelPath)) &&
      (await fileExists(`${modelPath}.json`))
    ) {
      return modelPath;
    }
  }
  return null;
}

/* =========================================================
 * 🎤 VOICES MANAGEMENT (ASYNC + CACHED)
 * ========================================================= */

export async function getAvailableVoices(
  context: vscode.ExtensionContext,
): Promise<string[]> {
  const dirs = [
    await getVoicesDir(context),
    ...(await getSharedVoicesDirs(context)),
  ];
  const voices = new Set<string>();

  for (const dir of dirs) {
    try {
      if (!(await fileExists(dir))) {
        continue;
      }
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.onnx')) {
          voices.add(path.basename(file, '.onnx'));
        }
      }
    } catch (error) {
      console.error('[voice-tts] Error reading voices directory:', error);
    }
  }

  return [...voices];
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
  // Check cache first
  const cached = context.globalState.get<VoicesCatalog>('voicesCatalog');
  if (cached) {
    return cached;
  }

  const voicesDir = await getVoicesDir(context);
  const voicesJsonPath = path.join(voicesDir, 'voices.json');

  try {
    const exists = await fileExists(voicesJsonPath);
    if (exists) {
      const voicesJson = await fs.promises.readFile(voicesJsonPath, 'utf8');
      const catalog = JSON.parse(voicesJson) as VoicesCatalog;
      // Cache for future use
      await context.globalState.update('voicesCatalog', catalog);
      return catalog;
    }
  } catch (error) {
    console.error('[voice-tts] Error parsing local voices.json:', error);
  }

  console.log('[voice-tts] Downloading voices.json from HuggingFace...');

  try {
    await fs.promises.mkdir(voicesDir, { recursive: true });
    // Dynamic import to avoid circular dependency
    const { downloadFile } = await import('./installer.js');
    await downloadFile(VOICES_JSON_URL, voicesJsonPath);
    const voicesJson = await fs.promises.readFile(voicesJsonPath, 'utf8');
    const catalog = JSON.parse(voicesJson) as VoicesCatalog;

    // Cache for future use
    await context.globalState.update('voicesCatalog', catalog);

    return catalog;
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

export async function getVoiceFilePaths(
  context: vscode.ExtensionContext,
  voiceId: string,
): Promise<{
  modelPath: string;
  configPath: string;
}> {
  const voicesDir = await getVoicesDir(context);
  return {
    modelPath: path.join(voicesDir, `${voiceId}.onnx`),
    configPath: path.join(voicesDir, `${voiceId}.onnx.json`),
  };
}

export async function isVoiceInstalled(
  context: vscode.ExtensionContext,
  voiceId: string,
): Promise<boolean> {
  // own dir or any sibling bastndev.* extension counts as installed
  return (await resolveVoiceModelPath(context, voiceId)) !== null;
}

export async function deleteVoiceFiles(
  context: vscode.ExtensionContext,
  voiceId: string,
): Promise<void> {
  const { modelPath, configPath } = await getVoiceFilePaths(context, voiceId);

  try {
    const modelExists = await fileExists(modelPath);
    if (modelExists) {
      await fs.promises.unlink(modelPath);
    }
  } catch (error) {
    console.error('[voice-tts] Error deleting model file:', error);
  }

  try {
    const configExists = await fileExists(configPath);
    if (configExists) {
      await fs.promises.unlink(configPath);
    }
  } catch (error) {
    console.error('[voice-tts] Error deleting config file:', error);
  }
}

/* =========================================================
 * ▶️ PLAYBACK (ASYNC)
 * ========================================================= */

let piperProcess: ChildProcess | undefined;
let playerProcess: ChildProcess | undefined;
let stoppedByUser = false;

export function wasStoppedByUser(): boolean {
  return stoppedByUser;
}

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

  const piperPath = await resolvePiperExecutablePath(context);
  const voicePath = await getVoicePath(context);

  const piperExists = await fileExists(piperPath);
  if (!piperExists) {
    throw new Error(`Piper executable not found at: ${piperPath}`);
  }

  const voiceExists = await fileExists(voicePath);
  if (!voiceExists) {
    throw new Error(
      `Voice model not found. Use "ATM Voice TTS: Download Voice" to add one.`,
    );
  }

  try {
    const fd = await fs.promises.open(voicePath, 'r');
    await fd.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Voice model file is not accessible: ${msg}`);
  }

  const playback = await getPlaybackCommand(context);

  stoppedByUser = false;

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

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

  return new Promise((resolve, reject) => {
    let settled = false;
    let piperClosed = false;
    let playerClosed = false;

    const resolveOnce = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const rejectOnce = (err: unknown) => {
      if (settled) {
        return;
      }
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

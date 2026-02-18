/**
 * Configuration constants for Voice TTS extension
 */

/** VS Code configuration section identifier */
export const CONFIG_SECTION = 'atm.voiceTts';

/** Default voice model to use when none is configured */
export const DEFAULT_VOICE = 'en_US-hfc_female-medium';

/** URL for the Piper voices catalog */
export const VOICES_JSON_URL =
  'https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json';

/** Base URL for downloading voice model files from HuggingFace */
export const VOICES_DOWNLOAD_BASE_URL =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/';

/** Supported platforms */
export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux'] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

/**
 * Piper TTS engine download URLs per platform/architecture.
 * From: https://github.com/rhasspy/piper/releases
 */
export const PIPER_RELEASE_BASE =
  'https://github.com/rhasspy/piper/releases/download/2023.11.14-2';

export interface PiperBinaryInfo {
  /** Download URL */
  url: string;
  /** Target directory name inside piper/ */
  dirName: string;
  /** Whether it's a tar.gz (true) or zip (false) */
  isTarGz: boolean;
}

export function getPiperDownloadInfo(): PiperBinaryInfo {
  const platform = process.platform;
  const arch = process.arch;

  switch (platform) {
    case 'win32':
      return {
        url: `${PIPER_RELEASE_BASE}/piper_windows_amd64.zip`,
        dirName: 'windows_amd64',
        isTarGz: false,
      };
    case 'darwin':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_macos_aarch64.tar.gz`,
          dirName: 'macos_aarch64',
          isTarGz: true,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_macos_x64.tar.gz`,
        dirName: 'macos_x64',
        isTarGz: true,
      };
    case 'linux':
      if (arch === 'arm64') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_aarch64.tar.gz`,
          dirName: 'linux_aarch64',
          isTarGz: true,
        };
      }
      if (arch === 'arm') {
        return {
          url: `${PIPER_RELEASE_BASE}/piper_linux_armv7l.tar.gz`,
          dirName: 'linux_armv7l',
          isTarGz: true,
        };
      }
      return {
        url: `${PIPER_RELEASE_BASE}/piper_linux_x86_64.tar.gz`,
        dirName: 'linux_x86_64',
        isTarGz: true,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Preset language definitions available for download.
 * Only EN (US) and ES (MX) are supported.
 */
export interface PresetLanguage {
  /** Display label */
  label: string;
  /** Short code for display in status bar */
  shortCode: string;
  /** Language key in voices.json catalog */
  catalogKey: string;
  /** Recommended voices for this language */
  recommendedVoices: PresetVoice[];
}

export interface PresetVoice {
  /** Voice name in catalog */
  name: string;
  /** Human-readable label */
  label: string;
  /** Recommended quality */
  quality: string;
  /** Voice description */
  description: string;
}

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
        description: 'Voz masculina — calidad media',
      },
    ],
  },
];

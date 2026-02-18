/**
 * Configuration constants for Voice TTS extension
 */

/** VS Code configuration section identifier */
export const CONFIG_SECTION = 'atm.voiceTts';

/** Default voice model to use when none is configured */
export const DEFAULT_VOICE = 'en_US-hfc_female-medium';

/** URL for the Piper voices catalog */
export const VOICES_JSON_URL = 'https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json';

/** Supported platforms */
export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux'] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

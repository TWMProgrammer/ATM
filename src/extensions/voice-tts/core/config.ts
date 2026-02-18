/**
 * Configuration constants for Voice TTS extension
 */

/** VS Code configuration section identifier */
export const CONFIG_SECTION = 'atm.voiceTts';

/** Default voice model to use when none is configured */
export const DEFAULT_VOICE = 'en_US-hfc_female-medium';

/** URL for the Piper voices catalog */
export const VOICES_JSON_URL = 'https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json';

/** Base URL for downloading voice model files from HuggingFace */
export const VOICES_DOWNLOAD_BASE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/';

/** Supported platforms */
export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux'] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

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
                description: 'Clear female voice — medium quality'
            },
            {
                name: 'hfc_male',
                label: 'HFC Male',
                quality: 'medium',
                description: 'Clear male voice — medium quality'
            }
        ]
    },
    {
        label: '🇲🇽 Español (MX)',
        shortCode: 'ES',
        catalogKey: 'es_MX',
        recommendedVoices: [
            {
                name: 'ald',
                label: 'Ald',
                quality: 'medium',
                description: 'Voz masculina — calidad media'
            }
        ]
    }
];

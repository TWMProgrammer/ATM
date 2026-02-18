/**
 * Type definitions for Voice TTS extension
 */

/** File entry inside a voice catalog entry */
export interface CatalogFileEntry {
    size_bytes: number;
    md5_digest: string;
}

/** Language info inside a catalog voice entry */
export interface CatalogLanguage {
    code: string;
    family: string;
    region: string;
    name_native: string;
    name_english: string;
    country_english: string;
}

/** Single voice entry in the flat voices.json catalog */
export interface CatalogVoiceEntry {
    key: string;
    name: string;
    language: CatalogLanguage;
    quality: string;
    num_speakers: number;
    speaker_id_map: Record<string, number>;
    files: Record<string, CatalogFileEntry>;
    aliases: string[];
}

/** Full voices catalog — flat map keyed by voice ID (e.g., "es_MX-ald-medium") */
export interface VoicesCatalog {
    [voiceId: string]: CatalogVoiceEntry;
}

/** Resolved download URLs for a voice */
export interface VoiceDownloadUrls {
    modelUrl: string;
    configUrl: string;
    modelSizeBytes: number;
}

/** Playback command configuration */
export interface PlaybackCommand {
    command: string;
    args: string[];
}

/** Public API exposed by the Voice TTS extension */
export interface VoiceTtsApi {
    readText(text: string): Promise<void>;
    stopPlayback(): void;
    selectVoice(): Promise<void>;
    downloadVoice(): Promise<void>;
    removeVoice(): Promise<void>;
}

/** Voice item for QuickPick display */
export interface VoiceQuickPickItem {
    label: string;
    description: string;
}

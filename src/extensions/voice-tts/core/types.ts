/**
 * Type definitions for Voice TTS extension
 */

/** Voice entry with model URLs for a specific quality/size */
export interface VoiceModelEntry {
    model: string;
    config: string;
}

/** Voice with multiple quality options */
export interface VoiceEntry {
    [quality: string]: VoiceModelEntry;
}

/** Language containing multiple voices */
export interface LanguageEntry {
    [voiceName: string]: VoiceEntry;
}

/** Full voices catalog structure from voices.json */
export interface VoicesCatalog {
    [language: string]: LanguageEntry;
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

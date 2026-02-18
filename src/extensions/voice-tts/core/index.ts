/**
 * Core module exports for Voice TTS extension
 */

// Configuration
export { CONFIG_SECTION, DEFAULT_VOICE, VOICES_JSON_URL, VOICES_DOWNLOAD_BASE_URL, PRESET_LANGUAGES } from './config';
export type { PresetLanguage, PresetVoice } from './config';

// Types
export type { 
    VoicesCatalog, 
    CatalogVoiceEntry,
    CatalogFileEntry,
    CatalogLanguage,
    VoiceDownloadUrls,
    PlaybackCommand,
    VoiceTtsApi,
    VoiceQuickPickItem
} from './types';

// Paths
export { 
    getResourcesBasePath, 
    getPiperPath, 
    getVoicePath, 
    getVoicesDir,
    getPlaybackCommand 
} from './paths';

// Download
export { downloadFile, formatBytes } from './download';
export type { DownloadProgress, ProgressCallback } from './download';

// Playback
export { readText, stopCurrentPlayback, isPlaying } from './playback';

// Voices
export { 
    getAvailableVoices, 
    getVoiceLabel, 
    loadVoicesCatalog,
    lookupVoice,
    resolveDownloadUrls,
    getVoiceFilePaths,
    isVoiceInstalled,
    deleteVoiceFiles
} from './voices';

// Symlinks
export { fixSymlinks, getLinuxArchitecture, getSymlinkMappings } from './symlinks';

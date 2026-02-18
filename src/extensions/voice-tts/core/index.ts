/**
 * Core module exports for Voice TTS extension
 */

// Configuration
export { CONFIG_SECTION, DEFAULT_VOICE, VOICES_JSON_URL } from './config';

// Types
export type { 
    VoicesCatalog, 
    VoiceEntry, 
    LanguageEntry, 
    VoiceModelEntry,
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
    getVoiceFilePaths,
    isVoiceInstalled,
    deleteVoiceFiles,
    extractLanguageCode,
    buildVoiceId
} from './voices';

// Symlinks
export { fixSymlinks, getLinuxArchitecture, getSymlinkMappings } from './symlinks';

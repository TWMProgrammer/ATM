export interface CatalogFileEntry {
  size_bytes: number;
  md5_digest: string;
}

export interface CatalogLanguage {
  code: string;
  family: string;
  region: string;
  name_native: string;
  name_english: string;
  country_english: string;
}

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

export interface VoicesCatalog {
  [voiceId: string]: CatalogVoiceEntry;
}

export interface VoiceDownloadUrls {
  modelUrl: string;
  configUrl: string;
  modelSizeBytes: number;
}

export interface PlaybackCommand {
  command: string;
  args: string[];
}

export interface VoiceTtsApi {
  readText(text: string): Promise<void>;
  stopPlayback(): void;
  selectVoice(): Promise<void>;
  downloadVoice(): Promise<void>;
  removeVoice(): Promise<void>;
}

export interface PresetLanguage {
  label: string;
  shortCode: string;
  catalogKey: string;
  recommendedVoices: PresetVoice[];
}

export interface PresetVoice {
  name: string;
  label: string;
  quality: string;
  description: string;
}

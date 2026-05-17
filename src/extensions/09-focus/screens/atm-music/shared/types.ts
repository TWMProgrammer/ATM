import type {
    MusicProvider as BaseMusicProvider,
    Track as BaseTrack,
    WebviewMessage as BaseWebviewMessage,
} from '../../../shared/types';

export type Track = BaseTrack;
export type WebviewMessage = BaseWebviewMessage;
export type MusicProvider = BaseMusicProvider;

export type AudioMode = 'music' | 'radio';
export type RadioStationId = 'normal' | 'lofi' | 'podcast';

export interface RadioStation {
    id: RadioStationId;
    label: string;
    description: string;
    provider: RadioStationId;
    streamUrl?: string;
}

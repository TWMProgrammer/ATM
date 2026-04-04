import { RadioStation } from '../../shared/types';

// Source: radio-browser.info (public domain station index)
export const FM_111_STREAM_URL = 'https://orf-live.ors-shoutcast.at/fm4-q2a';

export const RADIO_NORMAL_STATION: RadioStation = {
    id: 'normal',
    label: 'FM - 111',
    description: 'FM-style live radio stream (stable MP3).',
    provider: 'normal',
    streamUrl: FM_111_STREAM_URL,
};

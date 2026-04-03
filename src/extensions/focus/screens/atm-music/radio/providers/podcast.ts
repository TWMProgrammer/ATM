import { RadioStation } from '../../shared/types';

// Source: radio-browser.info (public domain station index)
export const PODCAST_STREAM_URL = 'https://live.devzen.ru/stream?type=.mp3';

export const RADIO_PODCAST_STATION: RadioStation = {
    id: 'podcast',
    label: 'Podcast',
    description: 'Podcast-first channel for long-form listening.',
    provider: 'podcast',
    streamUrl: PODCAST_STREAM_URL,
};

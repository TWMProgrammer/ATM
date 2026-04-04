import { RadioStation } from '../../shared/types';

// Source: radio-browser.info (public domain station index)
export const PODCAST_STREAM_URL = 'https://securestreams2.autopo.st:1185/;stream/1';

export const RADIO_PODCAST_STATION: RadioStation = {
    id: 'podcast',
    label: 'FM - Podcast',
    description: 'Podcast-first channel for long-form listening.',
    provider: 'podcast',
    streamUrl: PODCAST_STREAM_URL,
};

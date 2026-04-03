import { RadioStation } from '../../shared/types';

// Source: radio-browser.info (public domain station index)
export const LOFI_2026_STREAM_URL = 'http://usa9.fastcast4u.com/proxy/jamz?mp=/1';

export const RADIO_LOFI_STATION: RadioStation = {
    id: 'lofi',
    label: 'LoFi 2026',
    description: 'Calm low-fi radio stream for focus sessions.',
    provider: 'lofi',
    streamUrl: LOFI_2026_STREAM_URL,
};

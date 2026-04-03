import { RadioStation } from '../../shared/types';

// Source: radio-browser.info (public domain station index)
export const FM_111_STREAM_URL = 'http://media-ice.musicradio.com/CapitalMP3';

export const RADIO_NORMAL_STATION: RadioStation = {
    id: 'normal',
    label: 'FM - 111',
    description: 'Top hits FM-style radio stream.',
    provider: 'normal',
    streamUrl: FM_111_STREAM_URL,
};

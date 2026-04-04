export interface AmPeruStation {
	id: string;
	label: string;
	displayName: string;
	streamUrl: string;
}

// Source: radio-browser.info (Peru stations). Keep one stream per station.
export const AM_PERU_STATIONS: AmPeruStation[] = [
	{
		id: 'peru-norte',
		label: 'AM - Perú 🇵🇪 :: Norte',
		displayName: 'Boleros Inolvidables (FMLima)',
		streamUrl: 'https://stream.zeno.fm/5t45zksv7mruv',
	},
	{
		id: 'peru-este',
		label: 'AM - Perú 🇵🇪 :: Este',
		displayName: 'La Noventera',
		streamUrl: 'https://host.gometri.com/proxy/lanoventera/stream/',
	},
	{
		id: 'peru-oeste',
		label: 'AM - Perú 🇵🇪 :: Oeste',
		displayName: 'La Salsa Maestra',
		streamUrl: 'https://stream.zeno.fm/c1skkw28pfeuv',
	},
	{
		id: 'peru-sur',
		label: 'AM - Perú 🇵🇪 :: Sur',
		displayName: 'Radio Trinidad 1070 AM',
		streamUrl: 'https://maximacenterdata.com/8056/stream',
	},
];

// One station per country (except Peru, which has special multi-station handling).
export const AM_WORLD_STATIONS: AmPeruStation[] = [
	{
		id: 'us',
		label: 'AM - USA 🇺🇸',
		displayName: 'Classic Vinyl HD',
		streamUrl: 'https://icecast.walmradio.com:8443/classic',
	},
	{
		id: 'mx',
		label: 'AM - Mexico 🇲🇽',
		displayName: 'Radio Felicidad 1180 AM',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/XEFRAMAAC.aac',
	},
	{
		id: 'ar',
		label: 'AM - Argentina 🇦🇷',
		displayName: 'Aspen 102.3',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3',
	},
	{
		id: 'cl',
		label: 'AM - Chile 🇨🇱',
		displayName: 'BioBio Chile',
		streamUrl: 'https://unlimited3-cl.dps.live/biobiosantiago/aac/icecast.audio',
	},
	{
		id: 'co',
		label: 'AM - Colombia 🇨🇴',
		displayName: 'Caracol Radio Colombia',
		streamUrl: 'http://27323.live.streamtheworld.com:3690/CARACOL_RADIOAAC_SC',
	},
	{
		id: 'br',
		label: 'AM - Brazil 🇧🇷',
		displayName: 'Radio Mix 106.3 FM',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MIXFM_SAOPAULOAAC.aac',
	},
	{
		id: 'es',
		label: 'AM - Spain 🇪🇸',
		displayName: 'Cadena SER Espana',
		streamUrl: 'http://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3',
	},
	{
		id: 'fr',
		label: 'AM - France 🇫🇷',
		displayName: 'France Info',
		streamUrl: 'http://direct.franceinfo.fr/live/franceinfo-midfi.mp3',
	},
	{
		id: 'de',
		label: 'AM - Germany 🇩🇪',
		displayName: 'MANGORADIO',
		streamUrl: 'https://mangoradio.stream.laut.fm/mangoradio',
	},
	{
		id: 'it',
		label: 'AM - Italy 🇮🇹',
		displayName: 'Radio 24',
		streamUrl: 'http://shoutcast2.radio24.it:8000/;',
	},
	{
		id: 'gb',
		label: 'AM - United Kingdom 🇬🇧',
		displayName: 'BBC World Service',
		streamUrl: 'http://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
	},
	{
		id: 'jp',
		label: 'AM - Japan 🇯🇵',
		displayName: 'Anime Para Ti',
		streamUrl: 'https://stream.zeno.fm/qpn8mkt8c4duv',
	},
	{
		id: 'kr',
		label: 'AM - South Korea 🇰🇷',
		displayName: 'Big B Radio Kpop',
		streamUrl: 'https://antares.dribbcast.com/proxy/kpop?mp=/s',
	},
	{
		id: 'vn',
		label: 'AM - Vietnam 🇻🇳',
		displayName: 'RFI Tieng Viet',
		streamUrl: 'https://rfienvietnamien64k.ice.infomaniak.ch/rfienvietnamien-64.mp3',
	},
	{
		id: 'in',
		label: 'AM - India 🇮🇳',
		displayName: 'Bollywood Gaane Purane',
		streamUrl: 'https://stream.zeno.fm/6n6ewddtad0uv',
	},
	{
		id: 'tr',
		label: 'AM - Turkey 🇹🇷',
		displayName: 'Radyo 7',
		streamUrl: 'http://46.20.3.250/;stream',
	},
	{
		id: 'au',
		label: 'AM - Australia 🇦🇺',
		displayName: 'Sky News Australia Radio',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_SKYNEWSAAC.aac',
	},
	{
		id: 'ca',
		label: 'AM - Canada 🇨🇦',
		displayName: 'RdMix Classic Rock',
		streamUrl: 'https://cast1.torontocast.com:4610/stream',
	},
	{
		id: 'za',
		label: 'AM - South Africa 🇿🇦',
		displayName: 'Lesedi',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LESEDIAAC_SC',
	},
	{
		id: 'nl',
		label: 'AM - Netherlands 🇳🇱',
		displayName: 'JOE',
		streamUrl: 'https://stream.joe.nl/joe/aachigh',
	},
	{
		id: 'se',
		label: 'AM - Sweden 🇸🇪',
		displayName: 'Bandit Rock',
		streamUrl: 'http://fm02-ice.stream.khz.se/fm02_mp3',
	},
	{
		id: 'no',
		label: 'AM - Norway 🇳🇴',
		displayName: 'P4 Norge',
		streamUrl: 'https://p4.p4groupaudio.com/P04_AH',
	},
	{
		id: 'fi',
		label: 'AM - Finland 🇫🇮',
		displayName: 'Yle Radio Suomi',
		streamUrl: 'http://icecast.live.yle.fi/radio/YleRS/icecast.audio',
	},
	{
		id: 'pl',
		label: 'AM - Poland 🇵🇱',
		displayName: 'Radio 357',
		streamUrl: 'https://n-11-21.dcs.redcdn.pl/sc/o2/radio357/live/radio357_pr.livx?preroll=0',
	},
	{
		id: 'pt',
		label: 'AM - Portugal 🇵🇹',
		displayName: 'RFM',
		streamUrl: 'https://23603.live.streamtheworld.com/RFMAAC.aac',
	},
	{
		id: 'cn',
		label: 'AM - China 🇨🇳',
		displayName: 'FM100.8 Baohe Voice',
		streamUrl: 'https://lhttp-hw.qtfm.cn/live/5022668/64k.mp3',
	},
	{
		id: 'sg',
		label: 'AM - Singapore 🇸🇬',
		displayName: '938 Now Radio',
		streamUrl: 'http://playerservices.streamtheworld.com/api/livestream-redirect/938NOWAAC.aac',
	},
	{
		id: 'my',
		label: 'AM - Malaysia 🇲🇾',
		displayName: '988 FM',
		streamUrl: 'https://28103.live.streamtheworld.com/988_FMAAC.aac',
	},
	{
		id: 'id',
		label: 'AM - Indonesia 🇮🇩',
		displayName: 'Radio Suara Al-Iman 846 AM Surabaya',
		streamUrl: 'https://radioislamindonesia.com/aliman.mp3',
	},
	{
		id: 'th',
		label: 'AM - Thailand 🇹🇭',
		displayName: '101.5 Chula Radio',
		streamUrl: 'http://radio11.plathong.net:7590/;stream.mp3',
	},
	{
		id: 'ph',
		label: 'AM - Philippines 🇵🇭',
		displayName: 'Radyo Katribu Philippines Teleradyo',
		streamUrl: 'https://io.radyoph.com:8020/katribu',
	},
	{
		id: 'tw',
		label: 'AM - Taiwan 🇹🇼',
		displayName: '1766 Online Radio',
		streamUrl: 'http://livestream.1766.today:1768/live1.mp3',
	},
	{
		id: 'hk',
		label: 'AM - Hong Kong 🇭🇰',
		displayName: 'Apple FM',
		streamUrl: 'http://sc.apple-fm.net:9020/',
	},
];

export const AM_STATIONS: AmPeruStation[] = [
	...AM_PERU_STATIONS,
	...AM_WORLD_STATIONS,
];

// Backward-compatible default for existing imports.
export const AM_PERU_STREAM_URL = AM_PERU_STATIONS[0].streamUrl;

export function getRandomPeruAmStation(previousStationId: string | null): AmPeruStation {
	if (AM_STATIONS.length === 0) {
		return {
			id: 'peru-fallback',
			label: 'AM - Perú 🇵🇪 :: Norte',
			displayName: 'Fallback Peru Station',
			streamUrl: AM_PERU_STREAM_URL,
		};
	}

	if (AM_STATIONS.length === 1) {
		return AM_STATIONS[0];
	}

	const candidates = previousStationId
		? AM_STATIONS.filter((station) => station.id !== previousStationId)
		: AM_STATIONS;

	if (candidates.length === 0) {
		return AM_STATIONS[0];
	}

	const randomIndex = Math.floor(Math.random() * candidates.length);
	return candidates[randomIndex];
}

export function getNextPeruAmStation(previousStationId: string | null): AmPeruStation {
	if (AM_PERU_STATIONS.length === 0) {
		return {
			id: 'peru-fallback',
			label: 'AM - Perú 🇵🇪 | Norte',
			displayName: 'Fallback Peru Station',
			streamUrl: AM_PERU_STREAM_URL,
		};
	}

	if (!previousStationId) {
		return AM_PERU_STATIONS[0];
	}

	const currentIndex = AM_PERU_STATIONS.findIndex((station) => station.id === previousStationId);
	if (currentIndex < 0) {
		return AM_PERU_STATIONS[0];
	}

	const nextIndex = (currentIndex + 1) % AM_PERU_STATIONS.length;
	return AM_PERU_STATIONS[nextIndex];
}

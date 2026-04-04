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
		streamUrl: 'http://streamingcwsradio20.com:9410/stream',
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
		displayName: 'Radio Futuro',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/FUTURO_SC.mp3',
	},
	{
		id: 'co',
		label: 'AM - Colombia 🇨🇴',
		displayName: 'Radionica Colombia',
		streamUrl: 'http://shoutcast.rtvc.gov.co:8010/;',
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
		displayName: 'Kiss FM 87.6 Melbourne',
		streamUrl: 'http://cc.net2streams.com:8565/kissfm.mp3',
	},
	{
		id: 'ca',
		label: 'AM - Canada 🇨🇦',
		displayName: '#100 BEST IBIZA DEEP HOUSE',
		streamUrl: 'https://stream.zeno.fm/lwv6zqgtv1dtv',
	},
	{
		id: 'za',
		label: 'AM - South Africa 🇿🇦',
		displayName: 'Bosveld Stereo',
		streamUrl: 'http://capeant.antfarm.co.za:8000/Bosveld',
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
		displayName: '106,7 Rockklassiker',
		streamUrl: 'http://tx-bauerse.sharp-stream.com/http_live.php?ua=WEB&i=rockklassiker_instream_se_mp3',
	},
	{
		id: 'no',
		label: 'AM - Norway 🇳🇴',
		displayName: 'Nrk P1 Stor-Oslo',
		streamUrl: 'https://cdn0-47115-liveicecast0.dna.contentdelivery.net/p1_mp3_h',
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
		displayName: 'Radio Comercial Portugal',
		streamUrl: 'https://stream-icy.bauermedia.pt/comercial.mp3',
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
		streamUrl: 'http://19183.live.streamtheworld.com:3690/938NOW_PREM_SC',
	},
	{
		id: 'my',
		label: 'AM - Malaysia 🇲🇾',
		displayName: 'Jazz Lounge',
		streamUrl: 'http://eu8.fastcast4u.com:5068/;',
	},
	{
		id: 'id',
		label: 'AM - Indonesia 🇮🇩',
		displayName: 'I-Radio Jakarta',
		streamUrl: 'http://stream.radiojar.com/4ywdgup3bnzuv',
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
		displayName: 'MOR 101.9 FM',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MORFM_S01.mp3',
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
		displayName: 'D-100',
		streamUrl: 'http://59.152.232.107:8000/Channel1-128MP3',
	},
	{
		id: 'pk',
		label: 'AM - Pakistan 🇵🇰',
		displayName: '101 Peshawar',
		streamUrl: 'https://whmsonic.radio.gov.pk:8070/relay?type=http&nocache=9',
	},
	{
		id: 'bd',
		label: 'AM - Bangladesh 🇧🇩',
		displayName: 'A2Z Radio',
		streamUrl: 'https://listen.radioking.com/radio/1743/stream/125',
	},
	{
		id: 'np',
		label: 'AM - Nepal 🇳🇵',
		displayName: 'BBC Nepali',
		streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_nepali_radio',
	},
	{
		id: 'lk',
		label: 'AM - Sri Lanka 🇱🇰',
		displayName: 'Sun FM',
		streamUrl: 'https://radio.lotustechnologieslk.net:2020/stream/sunfmgarden',
	},
	{
		id: 'kh',
		label: 'AM - Cambodia 🇰🇭',
		displayName: 'National Radio of Kampuchea',
		streamUrl: 'http://119.82.252.6:8080/broadwave.mp3',
	},
	{
		id: 'la',
		label: 'AM - Laos 🇱🇦',
		displayName: 'Lao National Radio 103.7',
		streamUrl: 'https://radio.lnr.org.la/fm103',
	},
	{
		id: 'mm',
		label: 'AM - Myanmar 🇲🇲',
		displayName: 'Cherry FM',
		streamUrl: 'https://cherry.akiyaresearch.com:444/stream/89/',
	},
	{
		id: 'mn',
		label: 'AM - Mongolia 🇲🇳',
		displayName: 'Family Radio FM',
		streamUrl: 'https://c2.radioboss.fm/stream/394',
	},
	{
		id: 'kz',
		label: 'AM - Kazakhstan 🇰🇿',
		displayName: 'Beu FM',
		streamUrl: 'https://stream.beufm.kz/beufm',
	},
	{
		id: 'uz',
		label: 'AM - Uzbekistan 🇺🇿',
		displayName: 'Islom.uz',
		streamUrl: 'https://radio.islom.uz/islomuz',
	},
	{
		id: 'ch',
		label: 'AM - Switzerland 🇨🇭',
		displayName: 'SRF 3',
		streamUrl: 'http://stream.srg-ssr.ch/m/drs3/mp3_128',
	},
	{
		id: 'at',
		label: 'AM - Austria 🇦🇹',
		displayName: '1000 ELECTRONIC DANCE MUSIC',
		streamUrl: 'http://stream.laut.fm/1000-electronic-dance-music',
	},
	{
		id: 'be',
		label: 'AM - Belgium 🇧🇪',
		displayName: 'AFN 360 Benelux',
		streamUrl: 'http://27793.live.streamtheworld.com:3690/AFNE_BLX_SC',
	},
	{
		id: 'dk',
		label: 'AM - Denmark 🇩🇰',
		displayName: '100% Kim Larsen',
		streamUrl: 'http://stream2.wlmm.dk/kimlarsenmp3',
	},
	{
		id: 'cz',
		label: 'AM - Czech Republic 🇨🇿',
		displayName: 'ABradio Chillout',
		streamUrl: 'http://mp3stream4.abradio.cz/chillout128.mp3',
	},
	{
		id: 'gr',
		label: 'AM - Greece 🇬🇷',
		displayName: 'Alexandroupolis Dee Jay 94.8',
		streamUrl: 'https://stream.myip.gr/proxy/deejay?mp=/stream',
	},
	{
		id: 'hu',
		label: 'AM - Hungary 🇭🇺',
		displayName: '103.9 rock',
		streamUrl: 'https://icast.connectmedia.hu/5301/live.mp3',
	},
	{
		id: 'ro',
		label: 'AM - Romania 🇷🇴',
		displayName: '149FM',
		streamUrl: 'https://stream.zeno.fm/6vc4ddpr3ehvv',
	},
	{
		id: 'ua',
		label: 'AM - Ukraine 🇺🇦',
		displayName: '106.5 Kiss FM',
		streamUrl: 'https://online.kissfm.ua/KissFM_HD',
	},
	{
		id: 'uy',
		label: 'AM - Uruguay 🇺🇾',
		displayName: '102.3 FM Coronilla',
		streamUrl: 'https://streaming01.shockmedia.com.ar/9184/stream',
	},
	{
		id: 'py',
		label: 'AM - Paraguay 🇵🇾',
		displayName: '94.3 FM del Este',
		streamUrl: 'http://radio.cdehosting.net:8040/;',
	},
	{
		id: 'bo',
		label: 'AM - Bolivia 🇧🇴',
		displayName: 'Aiquilena Radio y Television',
		streamUrl: 'http://radios.istbolivia.com:8014/;',
	},
	{
		id: 'ec',
		label: 'AM - Ecuador 🇪🇨',
		displayName: 'Radio La Otra 91.3 FM',
		streamUrl: 'https://laotrafm.makrodigital.com/stream/laotrafmquito',
	},
	{
		id: 've',
		label: 'AM - Venezuela 🇻🇪',
		displayName: 'Union Radio 90.3 FM Caracas',
		streamUrl: 'http://ur58.lorini.net:2080/stream',
	},
	{
		id: 'cr',
		label: 'AM - Costa Rica 🇨🇷',
		displayName: '103 FM 103.1',
		streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CRC_103_1AAC.aac',
	},
	{
		id: 'pa',
		label: 'AM - Panama 🇵🇦',
		displayName: 'AL TOPE RADIO',
		streamUrl: 'https://server.laradio.online/proxy/edwin_chacon?mp=/stream',
	},
	{
		id: 'do',
		label: 'AM - Dominican Republic 🇩🇴',
		displayName: 'Club Sabroso Radio',
		streamUrl: 'http://s5.radio.co/s688b80b65/listen',
	},
	{
		id: 'gt',
		label: 'AM - Guatemala 🇬🇹',
		displayName: 'Actitud 100.9',
		streamUrl: 'https://ss.redradios.net:8002/stream?type=.mp3',
	},
	{
		id: 'hn',
		label: 'AM - Honduras 🇭🇳',
		displayName: 'Vox FM Honduras',
		streamUrl: 'https://ice42.securenetsystems.net/VOXFM',
	},
	{
		id: 'ni',
		label: 'AM - Nicaragua 🇳🇮',
		displayName: 'CAWtv Radio',
		streamUrl: 'https://stream.zeno.fm/m8aakwyw9u8uv',
	},
	{
		id: 'sv',
		label: 'AM - El Salvador 🇸🇻',
		displayName: '100.7 Stereo',
		streamUrl: 'https://stream20.usastreams.com/8138/stream',
	},
	{
		id: 'cu',
		label: 'AM - Cuba 🇨🇺',
		displayName: 'AFN 360 Guantanamo Bay',
		streamUrl: 'http://27783.live.streamtheworld.com:3690/AFNE_GMO_SC',
	},
	{
		id: 'jm',
		label: 'AM - Jamaica 🇯🇲',
		displayName: '808 Live Reggaecast',
		streamUrl: 'http://808.rastamusic.com/rastamusic.mp3',
	},
	{
		id: 'tt',
		label: 'AM - Trinidad and Tobago 🇹🇹',
		displayName: '102.1 Trinidad',
		streamUrl: 'http://psn3.prostreaming.net:8310/;',
	},
	{
		id: 'tz',
		label: 'AM - Tanzania 🇹🇿',
		displayName: 'Capital Radio',
		streamUrl: 'https://capitalradio.radioca.st/stream',
	},
	{
		id: 'ug',
		label: 'AM - Uganda 🇺🇬',
		displayName: '101.8 Radio Maria',
		streamUrl: 'http://dreamsiteradiocp.com:8052/stream',
	},
	{
		id: 'sn',
		label: 'AM - Senegal 🇸🇳',
		displayName: 'Afia FM 93.0 Dakar',
		streamUrl: 'https://stream.zeno.fm/skjrn6kzzxptv',
	},
	{
		id: 'et',
		label: 'AM - Ethiopia 🇪🇹',
		displayName: 'Addis Music',
		streamUrl: 'https://stream.zeno.fm/umguj2baxdctv',
	},
	{
		id: 'zw',
		label: 'AM - Zimbabwe 🇿🇼',
		displayName: 'Capitalk 100.4FM Harare',
		streamUrl: 'https://edge.iono.fm/xice/162_medium.aac',
	},
	{
		id: 'zm',
		label: 'AM - Zambia 🇿🇲',
		displayName: 'Sun FM Zambia',
		streamUrl: 'http://11233.cloudrad.io:9102/live',
	},
	{
		id: 'cm',
		label: 'AM - Cameroon 🇨🇲',
		displayName: 'Balla Radio',
		streamUrl: 'http://167.114.11.79:5730/;stream/1',
	},
	{
		id: 'nz',
		label: 'AM - New Zealand 🇳🇿',
		displayName: '100.3FM South Canterbury',
		streamUrl: 'http://uk4-vn.mixstream.net:8066/stream/1/',
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

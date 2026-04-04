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
		label: 'AM - Perú 🇵🇪 | Norte',
		displayName: 'Boleros Inolvidables (FMLima)',
		streamUrl: 'https://stream.zeno.fm/5t45zksv7mruv',
	},
	{
		id: 'peru-este',
		label: 'AM - Perú 🇵🇪 | Este',
		displayName: 'La Noventera',
		streamUrl: 'https://host.gometri.com/proxy/lanoventera/stream/',
	},
	{
		id: 'peru-oeste',
		label: 'AM - Perú 🇵🇪 | Oeste',
		displayName: 'La Salsa Maestra',
		streamUrl: 'https://stream.zeno.fm/c1skkw28pfeuv',
	},
	{
		id: 'peru-sur',
		label: 'AM - Perú 🇵🇪 | Sur',
		displayName: 'Radio Trinidad 1070 AM',
		streamUrl: 'https://maximacenterdata.com/8056/stream',
	},
];

// Backward-compatible default for existing imports.
export const AM_PERU_STREAM_URL = AM_PERU_STATIONS[0].streamUrl;

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

export const imageMarkerPattern = /\[Image #(\d+)\]/g;

export interface ProtectedImageMarker {
	marker: string;
	placeholder: string;
}

export function formatPromptTaskText(text: string): string {
	return text.replace(imageMarkerPattern, 'Image $1');
}

export function collectImageMarkerIds(text: string): Set<number> {
	const markerIds = new Set<number>();
	for (const match of text.matchAll(imageMarkerPattern)) {
		markerIds.add(Number(match[1]));
	}
	return markerIds;
}

export function protectImageMarkers(text: string): { text: string; markers: ProtectedImageMarker[] } {
	const markers: ProtectedImageMarker[] = [];
	const protectedText = text.replace(imageMarkerPattern, (marker, id: string) => {
		const placeholder = `ZXQATMIMAGE${id}QXZ`;
		markers.push({ marker, placeholder });
		return placeholder;
	});

	return { text: protectedText, markers };
}

export function restoreImageMarkers(text: string, markers: ProtectedImageMarker[]): string {
	return markers.reduce((result, { marker, placeholder }) =>
		result.replace(new RegExp(escapeRegExp(placeholder), 'g'), marker), text);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


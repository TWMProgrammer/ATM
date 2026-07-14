export class SvgIcons {
    private static toDataUri(svg: string): string {
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    }

    static getBrandMark(): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <defs><linearGradient id="g" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="#9B6DFF"/><stop offset="1" stop-color="#00C8B4"/></linearGradient></defs>
  <rect x="1" y="1" width="26" height="26" rx="7" fill="url(#g)"/>
  <path d="M7 19.5 11.3 8h2.4L18 19.5h-2.6l-.8-2.5h-4.3l-.8 2.5H7Zm4-4.8h2.9l-1.45-4.35L11 14.7ZM18.5 8H21v11.5h-2.5V8Z" fill="white"/>
</svg>`;
		return this.toDataUri(svg);
	}

	static getWidthSpacer(width: number): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="1" viewBox="0 0 ${width} 1"><path d="M0 .5h${width}" stroke="transparent"/></svg>`;
		return this.toDataUri(svg);
	}

    static getAudioWave(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 20 16">
  <rect x="2" y="6" width="2" height="4" fill="#CE9178" rx="1"/>
  <rect x="6" y="3" width="2" height="10" fill="#CE9178" rx="1"/>
  <rect x="10" y="5" width="2" height="6" fill="#CE9178" rx="1"/>
  <rect x="14" y="1" width="2" height="14" fill="#CE9178" rx="1"/>
  <rect x="18" y="6" width="2" height="4" fill="#CE9178" rx="1"/>
</svg>`;
        return this.toDataUri(svg);
    }
}

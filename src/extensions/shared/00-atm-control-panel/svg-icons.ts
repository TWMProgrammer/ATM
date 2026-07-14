import * as fs from 'fs';
import type * as vscode from 'vscode';

export class SvgIcons {
    private static brandMark: string | undefined;

    private static toDataUri(svg: string): string {
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    }

    static getBrandMark(context: vscode.ExtensionContext): string {
        if (!this.brandMark) {
            const logo = fs.readFileSync(context.asAbsolutePath('src/assets/atm-logo.png'));
            this.brandMark = `data:image/png;base64,${logo.toString('base64')}`;
        }

        return this.brandMark;
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

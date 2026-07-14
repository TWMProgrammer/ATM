/**
 * SVG icon for animated audio wave
 * Used in Terminal Sound section
 */

export class SvgIcons {
    /**
     * Generates a data URI for an SVG icon
     */
    private static toDataUri(svg: string): string {
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    }

    /**
     * Audio wave icon - Animated bars
     */
    static getAudioWave(): string {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 20 16">
  <rect x="2" y="6" width="2" height="4" fill="#CE9178" rx="1">
    <animate attributeName="height" values="4;10;4" dur="1s" repeatCount="indefinite"/>
    <animate attributeName="y" values="6;3;6" dur="1s" repeatCount="indefinite"/>
  </rect>
  <rect x="6" y="4" width="2" height="8" fill="#CE9178" rx="1">
    <animate attributeName="height" values="8;12;8" dur="1s" begin="0.2s" repeatCount="indefinite"/>
    <animate attributeName="y" values="4;2;4" dur="1s" begin="0.2s" repeatCount="indefinite"/>
  </rect>
  <rect x="10" y="5" width="2" height="6" fill="#CE9178" rx="1">
    <animate attributeName="height" values="6;9;6" dur="1s" begin="0.4s" repeatCount="indefinite"/>
    <animate attributeName="y" values="5;3.5;5" dur="1s" begin="0.4s" repeatCount="indefinite"/>
  </rect>
  <rect x="14" y="6" width="2" height="4" fill="#CE9178" rx="1">
    <animate attributeName="height" values="4;10;4" dur="1s" begin="0.6s" repeatCount="indefinite"/>
    <animate attributeName="y" values="6;3;6" dur="1s" begin="0.6s" repeatCount="indefinite"/>
  </rect>
</svg>`;
        return this.toDataUri(svg);
    }
}
